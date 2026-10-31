import { createGlobalState, useMagicKeys } from '@vueuse/core'
import { computed, inject, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { dialogKeys, useDialog } from '@/components/Dialog/composable'
import { useCheckDigit } from '@/composables/useCheckDigit/useCheckDigit'
import { useDataCode } from '@/composables/useDataCode/useDataCode'

import { useRecordStore } from '@/store/useRecordStore'
import { useSerialStore } from '@/store/useSerialStore'
import { useSettingStore } from '@/store/useSettingStore'

import {
  createFilePayload,
  FILE_RECORD_DISPLAY,
  FILE_SEND_CHUNK_SIZE,
  fileMetaFromPayload,
  LARGE_FILE_WARNING_SIZE,
} from '@/utils/filePayload'
import { getOS } from '@/utils/os'

export const useSendStore = createGlobalState(() => {
  const { sendHex: serialSendHex } = inject('serial')
  const { sendHex: bleSendHex } = inject('ble')
  const {
    addRecord,
    getRecordPayload,
    getRecentWriteRecords,
    getRecentWriteRecordSummaries,
  } = useRecordStore()
  const { open: openDialog } = useDialog()
  const { lineEnding, deviceType } = useSettingStore()
  const { sendType } = useSerialStore()
  const { checkAlgorithm, checkAlgorithms } = useCheckDigit()

  const {
    decStringToBuffer,
    hexStringToBuffer,
    stringToBuffer,
    stringToHexString,
    isHexString,
    bufferToHexFormat,
  } = useDataCode()

  const isAutoSending = ref(false)

  const sendData = ref('')
  const selectedFilePayload = ref(null)
  const textDraftBeforeFile = ref('')
  const fileSendProgress = ref(0)
  const isFileSending = ref(false)
  const historyDraftSnapshot = ref(null)
  const historyIndex = ref(-1) // -1表示当前输入，0及以上表示历史记录索引

  const hasSelectedFile = computed(() => !!selectedFilePayload.value)
  const canSend = computed(() => {
    if (hasSelectedFile.value)
      return deviceType.value === 'serial' && !isFileSending.value && !isAutoSending.value
    return sendData.value.length > 0 && !isAutoSending.value
  })

  // 输入尚未构成完整字节（例如奇数字符）时返回 undefined，
  // 保证校验位预览不会因为 computed 抛错而打断整个发送面板的渲染。
  const checkDigit = computed(() => {
    if (!checkAlgorithm.value || sendType.value !== 'hex')
      return undefined
    if (sendData.value.trim().length === 0)
      return undefined
    try {
      const algorithm = checkAlgorithms.value.find(item => item.name === checkAlgorithm.value)
      if (!algorithm)
        return undefined
      return algorithm.algorithm(hexStringToBuffer(sendData.value))
    }
    catch {
      return undefined
    }
  })

  const sendBuffer = computed(() => {
    if (sendType.value === 'hex') {
      const bytes = hexStringToBuffer(sendData.value)
      if (checkDigit.value?.length)
        return Uint8Array.from([...bytes, ...checkDigit.value])
      return bytes
    }
    else if (sendType.value === 'ascii') {
      return stringToBuffer(sendData.value + lineEnding.value)
    }
    else {
      return decStringToBuffer(sendData.value.replaceAll(' ', ''))
    }
  })

  const checkDigitHexFormat = computed(() => {
    if (!checkAlgorithm.value || !checkDigit.value?.length)
      return undefined
    return bufferToHexFormat(checkDigit.value)
  })

  async function sendHex(data) {
    if (deviceType.value === 'serial') {
      await serialSendHex(data)
    }
    else {
      await bleSendHex(data)
    }
  }

  async function sendFileChunks(data) {
    if (deviceType.value !== 'serial')
      throw new Error('BLE 暂不支持文件发送')

    if (data.byteLength === 0) {
      fileSendProgress.value = 100
      return
    }

    for (let offset = 0; offset < data.byteLength; offset += FILE_SEND_CHUNK_SIZE) {
      const end = Math.min(offset + FILE_SEND_CHUNK_SIZE, data.byteLength)
      await serialSendHex(data.subarray(offset, end))
      fileSendProgress.value = Math.round((end / data.byteLength) * 100)
    }
  }

  function clearSelectedFilePayload({ restoreText = true } = {}) {
    selectedFilePayload.value = null
    fileSendProgress.value = 0
    if (restoreText)
      sendData.value = textDraftBeforeFile.value
    textDraftBeforeFile.value = ''
  }

  async function sendFile() {
    const payload = selectedFilePayload.value
    if (!payload)
      return

    isFileSending.value = true
    fileSendProgress.value = 0
    try {
      await sendFileChunks(payload.data)
      try {
        await addRecord({
          type: 'write',
          data: payload.data,
          time: new Date(),
          display: FILE_RECORD_DISPLAY,
          fileMeta: fileMetaFromPayload(payload),
        })
      }
      catch (error) {
        console.error('保存文件发送记录失败:', error)
        toast.error('文件发送成功，但记录保存失败')
      }

      try {
        await refreshSendHistory()
      }
      catch (error) {
        console.warn('刷新发送历史失败:', error)
      }
      clearSelectedFilePayload()
      resetHistoryIndex()
    }
    catch (error) {
      console.error('文件发送失败:', error)
      toast.error(error?.message || '文件发送失败')
      throw error
    }
    finally {
      isFileSending.value = false
      fileSendProgress.value = selectedFilePayload.value ? fileSendProgress.value : 0
    }
  }

  async function readFileBytes(file) {
    if (typeof file.arrayBuffer === 'function')
      return new Uint8Array(await file.arrayBuffer())
    return new Uint8Array(await new Response(file).arrayBuffer())
  }

  async function send() {
    if (selectedFilePayload.value) {
      await sendFile()
      return
    }

    const data = sendBuffer.value
    await sendHex(data)
    await addRecord({
      type: 'write',
      data,
      time: new Date(),
      display: sendType.value,
    })
    await refreshSendHistory()
  }

  // Quick commands send their own content, without replacing the editor draft or selected file.
  async function sendText(content, display = 'ascii') {
    let data
    if (display === 'hex') {
      const bytes = hexStringToBuffer(content)
      const algorithm = checkAlgorithms.value.find(item => item.name === checkAlgorithm.value)
      data = algorithm ? Uint8Array.from([...bytes, ...algorithm.algorithm(bytes)]) : bytes
    }
    else {
      data = stringToBuffer(content + lineEnding.value)
    }
    await sendHex(data)
    await addRecord({ type: 'write', data, time: new Date(), display })
    await refreshSendHistory()
  }

  async function selectFile(file) {
    if (!file)
      return
    if (deviceType.value !== 'serial') {
      toast.warning('BLE 暂不支持文件发送')
      return
    }

    resetHistoryIndex()
    if (!selectedFilePayload.value)
      textDraftBeforeFile.value = sendData.value

    const data = await readFileBytes(file)
    selectedFilePayload.value = createFilePayload({ file, data })
    sendData.value = ''
    fileSendProgress.value = 0

    if (file.size > LARGE_FILE_WARNING_SIZE)
      toast.warning('文件较大，发送和查看可能耗时')
  }

  function removeSelectedFile() {
    resetHistoryIndex()
    clearSelectedFilePayload()
  }

  function openSelectedFilePreview() {
    if (!selectedFilePayload.value)
      return
    openDialog(dialogKeys.filePreview, selectedFilePayload.value)
  }
  watch(sendType, (value) => {
    if (selectedFilePayload.value)
      return
    if (!sendData.value)
      return
    if (value === 'hex') {
    // 若为普通字符串,先取编码,然后转换为hex格式
      if (!isHexString(sendData.value)) {
        sendData.value = stringToHexString(sendData.value)
      }
    }
  })

  const workerSendHistory = ref([])
  const sendHistory = computed(() => workerSendHistory.value)

  async function refreshSendHistory() {
    if (getRecentWriteRecordSummaries) {
      workerSendHistory.value = await getRecentWriteRecordSummaries(100)
      return
    }
    if (getRecentWriteRecords)
      workerSendHistory.value = await getRecentWriteRecords(100)
  }

  function onInput() {
    // 当用户手动输入时，重置历史索引
    resetHistoryIndex()

    if (sendType.value === 'hex') {
      sendData.value = sendData.value
        .replace(/([^0-9a-f\s])/gi, '')
        .toUpperCase()
    }
    else if (sendType.value === 'dec') {
      // 注意：需要 g 标志，否则只会过滤掉第一个非数字字符
      sendData.value = sendData.value
        .replace(/\D/g, '')
    }
  }

  function clear() {
    if (selectedFilePayload.value) {
      clearSelectedFilePayload()
      return
    }
    sendData.value = ''
  }

  const keys = useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (e.ctrlKey && e.key === 's' && e.type === 'keydown')
        e.preventDefault()
      if (e.metaKey && e.key === 's' && e.type === 'keydown')
        e.preventDefault()
    },
  })

  // 根据操作系统选择合适的快捷键
  const isMac = (getOS() === 'MacOS' || getOS() === 'iOS')
  const saveKey = isMac ? keys['Cmd+S'] : keys['Ctrl+S']

  const up = keys.Up
  const down = keys.Down

  if (saveKey) {
    watch(saveKey, (v) => {
      if (v)
        reformat()
    })
  }

  if (up) {
    watch(up, (v) => {
      if (v && document.activeElement?.id === 'send-panel-input')
        navigateHistory('up')
    })
  }
  if (down) {
    watch(down, (v) => {
      if (v && document.activeElement?.id === 'send-panel-input')
        navigateHistory('down')
    })
  }

  function reformat() {
    if (sendType.value === 'hex') {
      reformatHex()
    }
  }

  function reformatHex() {
    // 先按空白分割并去掉空字符串，纯空白输入直接忽略
    const groups = sendData.value.split(' ').filter(item => item)
    if (groups.length === 0)
      return
    // 在长度为奇数的字符串的最后一位前补0
    const normalized = groups
      .map((item) => {
        if (item.length % 2 === 1) {
          // 最后一位前补0
          return `${item.slice(0, item.length - 1)}0${item.slice(item.length - 1)}`
        }
        return item
      })
      .join('')
    // 将字符串按照每两个字符分割（match 可能返回 null）
    sendData.value = (normalized.match(/.{1,2}/g) ?? []).join(' ')
  }

  function createDraftSnapshot() {
    if (selectedFilePayload.value) {
      return {
        type: FILE_RECORD_DISPLAY,
        payload: createFilePayload({
          data: selectedFilePayload.value.data,
          fileMeta: fileMetaFromPayload(selectedFilePayload.value),
        }),
        textDraftBeforeFile: textDraftBeforeFile.value,
      }
    }

    return {
      type: 'text',
      sendData: sendData.value,
      textDraftBeforeFile: textDraftBeforeFile.value,
    }
  }

  function restoreDraftSnapshot(snapshot) {
    if (snapshot?.type === FILE_RECORD_DISPLAY) {
      selectedFilePayload.value = snapshot.payload
      textDraftBeforeFile.value = snapshot.textDraftBeforeFile || ''
      sendData.value = ''
      fileSendProgress.value = 0
      return
    }

    selectedFilePayload.value = null
    textDraftBeforeFile.value = ''
    fileSendProgress.value = 0
    sendData.value = snapshot?.sendData || ''
  }

  function applyPayloadRecord(payloadRecord) {
    if (!payloadRecord)
      return
    const recordData = payloadRecord.data || new Uint8Array(payloadRecord.dataBuffer || [])

    if (payloadRecord.display === FILE_RECORD_DISPLAY) {
      selectedFilePayload.value = createFilePayload({
        data: recordData,
        fileMeta: payloadRecord.fileMeta || {
          name: payloadRecord.text,
          size: payloadRecord.byteLength,
        },
      })
      textDraftBeforeFile.value = historyDraftSnapshot.value?.type === 'text'
        ? historyDraftSnapshot.value.sendData
        : ''
      sendData.value = ''
      fileSendProgress.value = 0
      return
    }

    selectedFilePayload.value = null
    textDraftBeforeFile.value = ''

    if (payloadRecord.display === 'hex') {
      sendData.value = bufferToHexFormat(recordData)
    }
    else if (payloadRecord.display === 'ascii') {
      const decoder = new TextDecoder()
      let text = decoder.decode(recordData)
      if (lineEnding.value && text.endsWith(lineEnding.value))
        text = text.slice(0, -lineEnding.value.length)
      sendData.value = text
    }
    else {
      sendData.value = Array.from(recordData).join(' ')
    }
  }

  function applyHistoryRecord(record) {
    if (!record)
      return undefined

    if (record.data || record.dataBuffer) {
      applyPayloadRecord(record)
      return undefined
    }

    if (!record.id || !getRecordPayload) {
      applyPayloadRecord(record)
      return undefined
    }

    return getRecordPayload(record.id).then(applyPayloadRecord)
  }

  async function navigateHistory(direction) {
    await refreshSendHistory()
    const history = sendHistory.value
    if (history.length === 0)
      return

    const oldIndex = historyIndex.value
    if (oldIndex === -1 && direction === 'up')
      historyDraftSnapshot.value = createDraftSnapshot()

    if (direction === 'up') {
      // 向上导航到更早的历史记录（historyIndex === -1 时会落到 0）
      if (historyIndex.value < history.length - 1)
        historyIndex.value++
    }
    else if (direction === 'down') {
      // 向下导航到更新的历史记录
      if (historyIndex.value > 0) {
        historyIndex.value--
      }
      else if (historyIndex.value === 0) {
        // 回到当前输入状态
        historyIndex.value = -1
      }
    }

    if (oldIndex === -1 && historyIndex.value === -1)
      return

    if (historyIndex.value === -1) {
      restoreDraftSnapshot(historyDraftSnapshot.value)
      historyDraftSnapshot.value = null
    }
    else {
      const record = history[history.length - 1 - historyIndex.value]
      const pendingApply = applyHistoryRecord(record)
      if (pendingApply)
        await pendingApply
    }
  }

  // 当用户手动输入时，重置历史索引
  function resetHistoryIndex() {
    historyIndex.value = -1
    historyDraftSnapshot.value = null
  }

  return {
    isAutoSending,
    isFileSending,
    fileSendProgress,
    selectedFilePayload,
    hasSelectedFile,
    canSend,
    sendData,
    clear,
    sendHistory,
    onInput,
    sendBuffer,
    send,
    sendText,
    selectFile,
    removeSelectedFile,
    openSelectedFilePreview,
    sendType,
    checkAlgorithm,
    checkAlgorithms,
    checkDigitHexFormat,
    reformat,
    resetHistoryIndex,
    historyIndex,
    navigateHistory,
  }
})
