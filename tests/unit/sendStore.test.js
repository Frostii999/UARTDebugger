import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { useCheckDigit } from '@/composables/useCheckDigit/useCheckDigit'
import { useSendStore } from '@/store/useSendStore'

// useSendStore 依赖 inject() 提供的串口/BLE 通道，这里用一个最小 app 上下文启动。
const app = createApp({})
app.provide('serial', { sendHex: vi.fn() })
app.provide('ble', { sendHex: vi.fn() })
const store = app.runWithContext(() => useSendStore())
const { checkAlgorithm } = useCheckDigit()

beforeEach(() => {
  store.sendData.value = ''
  store.sendType.value = 'hex'
  checkAlgorithm.value = undefined
})

describe('onInput 输入过滤', () => {
  it('hex 模式过滤所有非法字符并转大写', () => {
    store.sendData.value = 'a1-2g'
    store.onInput()
    expect(store.sendData.value).toBe('A12')
  })

  it('dec 模式过滤所有非数字字符（不只第一个）', () => {
    store.sendType.value = 'dec'
    store.sendData.value = '1a2b3c'
    store.onInput()
    expect(store.sendData.value).toBe('123')
  })
})

describe('reformat 整理 HEX 格式', () => {
  it('纯空白输入不再抛异常', () => {
    store.sendData.value = '   '
    expect(() => store.reformat()).not.toThrow()
  })

  it('补齐奇数字符并每两个一组', () => {
    store.sendData.value = 'a 1 02'
    store.reformat()
    expect(store.sendData.value).toBe('0a 01 02')
  })
})

describe('校验位', () => {
  it('输入不完整时预览为空而不是抛错', () => {
    checkAlgorithm.value = '校验和'
    store.sendData.value = '0A1'
    expect(() => store.checkDigitHexFormat.value).not.toThrow()
    expect(store.checkDigitHexFormat.value).toBeUndefined()
  })

  it('输入为空时预览为空', () => {
    checkAlgorithm.value = '校验和'
    store.sendData.value = ''
    expect(store.checkDigitHexFormat.value).toBeUndefined()
  })

  it('合法输入时展示校验字节并追加到发送数据', () => {
    checkAlgorithm.value = '校验和'
    store.sendData.value = '01 02'
    expect(store.checkDigitHexFormat.value).toBe('0x03')
    expect(Array.from(store.sendBuffer.value)).toEqual([0x01, 0x02, 0x03])
  })

  it('未选择算法时不追加校验位', () => {
    store.sendData.value = '01 02'
    expect(Array.from(store.sendBuffer.value)).toEqual([0x01, 0x02])
  })
})

describe('sendBuffer 编码', () => {
  it('ascii 模式按文本编码', () => {
    store.sendType.value = 'ascii'
    store.sendData.value = 'AB'
    expect(Array.from(store.sendBuffer.value)).toEqual([0x41, 0x42])
  })

  it('hex 输入不完整时抛出可读错误', () => {
    store.sendData.value = '0A1'
    expect(() => store.sendBuffer.value).toThrowError(/完整字节/)
  })
})

describe('历史导航', () => {
  it('没有历史记录时按上键不报错且索引保持 -1', async () => {
    await store.navigateHistory('up')
    expect(store.historyIndex.value).toBe(-1)
  })
})
