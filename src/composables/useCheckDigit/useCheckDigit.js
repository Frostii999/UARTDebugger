import { ref } from 'vue'

// 校验算法 'checksum'
const checkAlgorithm = ref(undefined)

/**
 * 每个算法接收数据的 Uint8Array，返回需要追加到末尾的校验字节。
 * @typedef {(data: Uint8Array) => Uint8Array} CheckAlgorithm
 */

const checkAlgorithms = ref([
  {
    name: '校验和',
    algorithm: data => Uint8Array.from([data.reduce((a, b) => a + b, 0) & 0xFF]),
  },
  {
    name: '奇偶校验',
    algorithm: (data) => {
      const parity = data.reduce((a, b) => a + b, 0) % 2
      return Uint8Array.from([parity])
    },
  },
  {
    name: '异或校验',
    algorithm: data => Uint8Array.from([data.reduce((a, b) => a ^ b, 0)]),
  },
  {
    name: 'ModbusCRC16',
    algorithm: (data) => {
      let crc = 0xFFFF
      for (let i = 0; i < data.length; i++) {
        crc ^= data[i]
        for (let j = 0; j < 8; j++) {
          if (crc & 0x01) {
            crc >>= 1
            crc ^= 0xA001
          }
          else {
            crc >>= 1
          }
        }
      }
      return Uint8Array.from([crc & 0xFF, crc >> 8])
    },
  },
])

export function useCheckDigit() {
  return {
    checkAlgorithm,
    checkAlgorithms,
  }
}
