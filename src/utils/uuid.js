/**
 * 生成一个随机的 v4 uuid
 * 优先使用 Web Crypto，避免 Math.random() 带来的碰撞风险；
 * 在不支持 crypto.randomUUID 的环境（如非安全上下文）退化为 getRandomValues 或 Math.random。
 * @returns {string} uuid
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function')
      return crypto.randomUUID()

    if (typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      // 按 RFC 4122 设置版本号与变体位
      bytes[6] = (bytes[6] & 0x0F) | 0x40
      bytes[8] = (bytes[8] & 0x3F) | 0x80
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
