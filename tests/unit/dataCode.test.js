import { describe, expect, it } from 'vitest'
import { isHexString, useDataCode } from '@/composables/useDataCode/useDataCode'

const {
  bufferToDecFormat,
  bufferToHexFormat,
  decStringToBuffer,
  hexStringToBuffer,
  hexStringToHexFormat,
  stringToHexString,
} = useDataCode()

describe('hexStringToBuffer', () => {
  it('解析带空白和大写字母的 HEX 字符串', () => {
    expect(Array.from(hexStringToBuffer('0A 1b  FF'))).toEqual([0x0A, 0x1B, 0xFF])
    expect(Array.from(hexStringToBuffer('0a1bff'))).toEqual([0x0A, 0x1B, 0xFF])
  })

  it('空输入返回空数组', () => {
    expect(Array.from(hexStringToBuffer(''))).toEqual([])
    expect(Array.from(hexStringToBuffer('   '))).toEqual([])
  })

  it('非法字符与奇数字节给出可读错误', () => {
    expect(() => hexStringToBuffer('GG')).toThrowError(/只能包含/)
    expect(() => hexStringToBuffer('ABC')).toThrowError(/完整字节/)
  })
})

describe('hexStringToHexFormat', () => {
  it('空字符串不再抛 TypeError', () => {
    expect(hexStringToHexFormat('')).toBe('')
    expect(hexStringToHexFormat('   ')).toBe('')
  })

  it('输出 0x 前缀的格式化结果', () => {
    expect(hexStringToHexFormat('0a1b')).toBe('0x0A, 0x1B')
  })
})

describe('isHexString', () => {
  it('始终返回布尔值', () => {
    expect(isHexString('0A1B')).toBe(true)
    expect(isHexString('0A1B')).not.toBeInstanceOf(Array)
    expect(isHexString('')).toBe(false)
    expect(isHexString('12 34')).toBe(false)
    expect(isHexString('XYZ')).toBe(false)
  })
})

describe('decStringToBuffer', () => {
  it('把十进制字符串转成大端字节', () => {
    expect(Array.from(decStringToBuffer('255'))).toEqual([0xFF])
    expect(Array.from(decStringToBuffer('256'))).toEqual([0x01, 0x00])
    expect(bufferToDecFormat(Uint8Array.from([0x01, 0x00]))).toBe('256')
  })

  it('拒绝非数字输入', () => {
    expect(() => decStringToBuffer('12a')).toThrowError(/只能包含数字/)
  })
})

describe('stringToHexString', () => {
  it('把 ASCII 字符串转成大写 HEX', () => {
    expect(stringToHexString('AB')).toBe('4142')
  })

  it('bufferToHexFormat 输出 0x 前缀', () => {
    expect(bufferToHexFormat(Uint8Array.from([1, 255]))).toBe('0x01, 0xFF')
  })
})
