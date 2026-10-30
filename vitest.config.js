import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 源码头部的 import 大多显式声明，但 vite.config.js 里的 AutoImport 会对
// src/composables/**、src/utils/** 做自动导入，测试环境保持一致以免行为差异。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    globals: false,
    restoreMocks: true,
  },
})
