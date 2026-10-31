import { describe, expect, it } from 'vitest'
import { useCheckDigit } from '@/composables/useCheckDigit/useCheckDigit'

const { checkAlgorithms } = useCheckDigit()

function algorithmOf(name) {
  const item = checkAlgorithms.value.find(item => item.name === name)
  if (!item)
    throw new Error(`未找到校验算法: ${name}`)
  return item.algorithm
}

describe('校验算法', () => {
  it('校验和为累加低 8 位', () => {
    expect(Array.from(algorithmOf('校验和')(Uint8Array.from([0x01, 0x02])))).toEqual([0x03])
    expect(Array.from(algorithmOf('校验和')(Uint8Array.from([0xFF, 0x02])))).toEqual([0x01])
  })

  it('异或校验为逐字节异或', () => {
    expect(Array.from(algorithmOf('异或校验')(Uint8Array.from([0x0F, 0x0F, 0xFF])))).toEqual([0xFF])
  })

  it('奇偶校验返回累加和的奇偶位', () => {
    expect(Array.from(algorithmOf('奇偶校验')(Uint8Array.from([0x01, 0x02])))).toEqual([1])
    expect(Array.from(algorithmOf('奇偶校验')(Uint8Array.from([0x02, 0x02])))).toEqual([0])
  })

  it('modbus crc16 结果符合标准测试向量（低字节在前）', () => {
    // 01 03 00 00 00 01 -> CRC16 = 0x0A84，发送顺序 0x84 0x0A
    const crc = algorithmOf('ModbusCRC16')(Uint8Array.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]))
    expect(Array.from(crc)).toEqual([0x84, 0x0A])
  })

  it('空数据不会抛错', () => {
    for (const item of checkAlgorithms.value)
      expect(() => item.algorithm(new Uint8Array())).not.toThrow()
  })
})
