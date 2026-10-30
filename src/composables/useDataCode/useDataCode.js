import { useLocalStorage } from '@vueuse/core'
import str2gbk from 'str2gbk'
// 编码 UTF-8 GBK
const dataCode = useLocalStorage('dataCode', 'UTF-8', {
  listenToStorageChanges: false,
})

const gbkDecoder = new TextDecoder('gbk')
const utf8Decoder = new TextDecoder()

function hexStringToHexFormat(str) {
  const groups = String(str).replace(/\s/g, '').match(/.{1,2}/g)
  if (!groups)
    return ''
  return `0x${groups.map(i => i.toUpperCase()).join(', 0x')}`
}

function hexStringToBuffer(str) {
  str = String(str).replace(/\s/g, '')
  if (!str)
    return new Uint8Array()
  if (!/^[0-9a-f]+$/i.test(str))
    throw new Error('HEX 数据只能包含 0–9、A–F 和空白字符')
  if (str.length % 2 !== 0)
    throw new Error('HEX 数据需要完整字节（每字节两位），可点击整理发送格式补齐')
  return Uint8Array.from(
    str.match(/.{1,2}/g).map(byte => Number.parseInt(byte, 16)),
  )
}

function bufferToHexString(buffer) {
  return Array.from(buffer)
    .map(i => i.toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

function bufferToHexFormat(buffer) {
  return Array.from(buffer)
    .map(i => `0x${i.toString(16).padStart(2, '0').toUpperCase()}`)
    .join(', ')
}

function bufferToString(buffer) {
  if (dataCode.value === 'UTF-8') {
    return utf8Decoder.decode(buffer)
  }
  return gbkDecoder.decode(buffer)
}
function stringToBuffer(str) {
  if (dataCode.value === 'UTF-8') {
    return new TextEncoder().encode(str)
  }
  return str2gbk(str)
}

function stringToHexFormat(str) {
  return bufferToHexFormat(stringToBuffer(str))
}

function stringToHexString(str) {
  return bufferToHexString(stringToBuffer(str))
}

function decStringToBuffer(str) {
  const normalized = String(str).replace(/\s/g, '')
  if (!normalized)
    return new Uint8Array()
  if (!/^\d+$/.test(normalized))
    throw new Error('十进制数据只能包含数字')
  const hex = BigInt(normalized).toString(16)
  return hexStringToBuffer(hex.length % 2 ? `0${hex}` : hex)
}

function bufferToDecString(buffer) {
  const hex = bufferToHexString(buffer)
  return hex ? BigInt(`0x${hex}`).toString() : '0'
}

function stringToHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll(' ', '&nbsp;')
    .replaceAll('\r\n', '<br/>')
    .replaceAll('\n', '<br/>')
    .replaceAll('\r', '<br/>')
}

/**
 * 判断字符串是否为合法的 HEX 数据（不含空白，且至少一个字符）
 * @param {string} str 待判断的字符串
 * @returns {boolean} 是否为合法 HEX
 */
export function isHexString(str) {
  return /^[0-9a-f]+$/i.test(String(str ?? ''))
}
export function useDataCode() {
  return {
    decStringToBuffer,
    hexStringToHexFormat,
    hexStringToBuffer,
    bufferToHexString,
    bufferToHexFormat,
    bufferToDecFormat: bufferToDecString,
    bufferToString,
    stringToBuffer,
    stringToHexFormat,
    stringToHexString,
    stringToHtml,
    isHexString,
    dataCode,
  }
}
