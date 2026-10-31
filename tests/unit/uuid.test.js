import { describe, expect, it } from 'vitest'
import { generateUUID } from '@/utils/uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('generateUUID', () => {
  it('生成符合 v4 格式的 UUID', () => {
    expect(generateUUID()).toMatch(UUID_V4)
  })

  it('连续生成互不重复', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateUUID()))
    expect(set.size).toBe(1000)
  })
})
