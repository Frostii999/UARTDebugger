<script setup>
import { useLocalStorage } from '@vueuse/core'
import { computed, inject, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import { toast } from 'vue-sonner'
import draggable from 'vuedraggable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useSendStore } from '@/store/useSendStore'

const { sendText, isFileSending, sendType } = useSendStore()

// 获取串口和蓝牙连接状态
const serial = inject('serial')
const ble = inject('ble')

// 计算设备是否已连接
const isConnected = computed(() => serial.connected.value || ble.connected.value)

// 确认对话框状态
const showClearConfirm = ref(false)
const showResetConfirm = ref(false)

// 循环发送状态
const isLoopSending = ref(false)
const loopInterval = ref(5000) // 默认循环间隔5秒
const loopTimer = ref(null)

// 默认快捷输入数据
const defaultQuickInputs = [
  { id: useId(), enabled: true, content: 'AT+RST', remark: '重启模块', index: 1, delay: 1000, isHex: false, showRemarkEdit: false },
  { id: useId(), enabled: true, content: 'AT+GMR', remark: '查询版本信息', index: 2, delay: 1000, isHex: false, showRemarkEdit: false },
  { id: useId(), enabled: true, content: 'AT+CWLAP', remark: '扫描WiFi热点', index: 3, delay: 1000, isHex: false, showRemarkEdit: false },
  { id: useId(), enabled: false, content: '01 02 03 04', remark: 'HEX测试数据', index: 4, delay: 1000, isHex: true, showRemarkEdit: false },
  { id: useId(), enabled: false, content: 'AT+CWJAP="SSID","PASSWORD"', remark: '连接WiFi网络', index: 5, delay: 1000, isHex: false, showRemarkEdit: false },
]

// 使用本地存储保存快捷输入数据
const quickInputs = useLocalStorage('quickInputs', defaultQuickInputs)

// 新增一行
function addRow() {
  quickInputs.value.push({
    id: crypto.randomUUID(),
    enabled: false,
    content: '',
    index: quickInputs.value.length + 1,
    delay: 1000,
    isHex: sendType.value === 'hex',
    remark: '',
    showRemarkEdit: false,
  })
  updateIndexes()
}

// 删除一行
function deleteRow(id) {
  const index = quickInputs.value.findIndex(item => item.id === id)
  if (index !== -1) {
    quickInputs.value.splice(index, 1)
    updateIndexes()
  }
}

// 更新索引
function updateIndexes() {
  quickInputs.value.forEach((item, index) => {
    item.index = index + 1
  })
}

// 全部启用
function enableAll() {
  quickInputs.value.forEach((item) => {
    item.enabled = true
  })
}

// 全部禁用
function disableAll() {
  quickInputs.value.forEach((item) => {
    item.enabled = false
  })
}

// 清空所有数据
function clearAll() {
  showClearConfirm.value = true
}

// 执行清空操作
function confirmClear() {
  quickInputs.value = []
  updateIndexes()
  showClearConfirm.value = false
}

// 重置为默认配置
function resetToDefault() {
  showResetConfirm.value = true
}

// 执行重置操作
function confirmReset() {
  quickInputs.value = JSON.parse(JSON.stringify(defaultQuickInputs))
  updateIndexes()
  showResetConfirm.value = false
}

// 导出配置
function exportConfig() {
  const data = JSON.stringify(quickInputs.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quick-inputs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 导入配置
function importConfig() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (Array.isArray(data) && data.every(item => item && typeof item.content === 'string')) {
            quickInputs.value = data.map(item => ({
              id: crypto.randomUUID(),
              enabled: !!item.enabled,
              content: item.content,
              remark: String(item.remark || ''),
              delay: Math.max(0, Number(item.delay) || 0),
              isHex: !!item.isHex,
            }))
            updateIndexes()
          }
          else {
            toast.error('导入的文件格式不正确')
          }
        }
        catch (error) {
          toast.error(`导入失败：${error.message}`)
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

// 发送数据
const batchBusy = ref(false)
let generation = 0
let waitTimer = null
let finishWait = null
async function sendItem(item) {
  if (!item.content || !isConnected.value || isFileSending.value)
    return false
  try {
    await sendText(item.content, item.isHex ? 'hex' : 'ascii')
    return true
  }
  catch (error) {
    toast.error(error?.message || '快捷指令发送失败')
    stopLoopSending()
    return false
  }
}
function waitDelay(ms) {
  return new Promise((resolve) => {
    finishWait = resolve
    waitTimer = setTimeout(() => {
      finishWait = null
      waitTimer = null
      resolve()
    }, Math.max(0, Number(ms) || 0))
  })
}
async function sendAllEnabled(looping = false) {
  if (batchBusy.value || !isConnected.value || isFileSending.value)
    return
  const items = quickInputs.value.filter(item => item.enabled).map(item => ({ ...item }))
  if (!items.length) {
    toast.info('请先启用快捷指令')
    return
  }
  batchBusy.value = true
  const token = generation
  try {
    for (let index = 0; index < items.length; index++) {
      if (token !== generation || !isConnected.value || (looping && !isLoopSending.value))
        break
      if (!await sendItem(items[index]))
        break
      if (index < items.length - 1 && items[index].delay > 0)
        await waitDelay(items[index].delay)
    }
  }
  finally { batchBusy.value = false }
}
async function loopCycle(token) {
  if (!isLoopSending.value || token !== generation)
    return
  await sendAllEnabled(true)
  if (isLoopSending.value && token === generation)
    loopTimer.value = setTimeout(() => loopCycle(token), Math.max(10, Number(loopInterval.value) || 1000))
}
function startLoopSending() {
  if (isLoopSending.value || batchBusy.value || !isConnected.value)
    return
  if (!quickInputs.value.some(item => item.enabled)) {
    toast.info('请先启用快捷指令')
    return
  }
  isLoopSending.value = true
  generation++
  loopCycle(generation)
}
function stopLoopSending() {
  generation++
  isLoopSending.value = false
  clearTimeout(loopTimer.value)
  loopTimer.value = null
  clearTimeout(waitTimer)
  waitTimer = null
  finishWait?.()
  finishWait = null
}
watch(isConnected, (connected) => {
  if (!connected)
    stopLoopSending()
})

// 组件挂载和卸载时的处理
onMounted(() => {
  updateIndexes()
})

onUnmounted(() => {
  stopLoopSending()
})
</script>

<template>
  <aside class="command-panel">
    <header class="command-header">
      <div><span class="panel-eyebrow">COMMANDS</span><h3>快捷指令</h3></div><Button variant="outline" size="sm" aria-label="新增指令" @click="addRow">
        ＋ 新增
      </Button>
    </header>
    <div class="command-tools">
      <button title="全部启用" @click="enableAll">
        全选
      </button><button title="全部禁用" @click="disableAll">
        取消
      </button>
      <button title="导入 JSON" aria-label="导入指令" @click="importConfig">
        导入
      </button><button title="导出 JSON" aria-label="导出指令" @click="exportConfig">
        导出
      </button>
      <button title="恢复默认指令" @click="resetToDefault">
        重置
      </button><button title="清空全部指令" @click="clearAll">
        清空
      </button>
    </div>
    <div class="command-batch">
      <Button size="sm" :disabled="!isConnected || isLoopSending || batchBusy || isFileSending" @click="sendAllEnabled()">
        发送选中
      </Button>
      <Button size="sm" variant="outline" :disabled="!isConnected || isFileSending" @click="isLoopSending ? stopLoopSending() : startLoopSending()">
        {{ isLoopSending ? '停止循环' : '循环发送' }}
      </Button>
      <label class="command-interval">循环间隔 <Input v-model="loopInterval" type="number" min="10" step="100" aria-label="快捷指令循环间隔" :disabled="isLoopSending" /> ms</label>
    </div>
    <div class="command-scroll">
      <draggable v-model="quickInputs" item-key="id" handle=".command-handle" @end="updateIndexes">
        <template #item="{ element: item, index }">
          <article class="command-card" :class="{ enabled: item.enabled }">
            <div class="command-card-top">
              <label><input v-model="item.enabled" type="checkbox" :aria-label="`启用指令 ${index + 1}`">启用</label><span class="command-handle" title="拖动排序">⠿ #{{ String(index + 1).padStart(2, '0') }}</span><label class="command-hex"><input v-model="item.isHex" type="checkbox" :aria-label="`HEX 指令 ${index + 1}`">HEX</label>
            </div>
            <Input v-model="item.content" placeholder="请输入内容" :aria-label="`指令内容 ${index + 1}`" class="command-content serial-data-font" />
            <input v-model="item.remark" class="command-remark" :aria-label="`指令备注 ${index + 1}`" placeholder="添加备注…">
            <div class="command-card-bottom">
              <label>延时 <input v-model.number="item.delay" type="number" min="0" :aria-label="`指令延时 ${index + 1}`"> ms</label><button :disabled="!isConnected || batchBusy || isLoopSending || isFileSending" @click="sendItem(item)">
                发送 ↗
              </button><button class="command-delete" :aria-label="`删除指令 ${index + 1}`" @click="deleteRow(item.id)">
                ×
              </button>
            </div>
          </article>
        </template>
      </draggable>
      <p v-if="!quickInputs.length" class="py-8 text-center text-sm text-muted-foreground">
        点击“新增”创建第一条指令
      </p>
    </div>
    <footer class="command-footer">
      指令保存在本机 · 拖动编号可排序
    </footer>
  </aside>
  <!-- 清空确认对话框 -->
  <AlertDialog v-model:open="showClearConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认清空</AlertDialogTitle>
        <AlertDialogDescription>
          确定要清空所有快捷输入项吗？
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="confirmClear">
          确认
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 重置确认对话框 -->
  <AlertDialog v-model:open="showResetConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认重置</AlertDialogTitle>
        <AlertDialogDescription>
          确定要重置快捷输入为默认配置吗？这将覆盖快捷输入当前所有设置。
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction @click="confirmReset">
          确认
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
