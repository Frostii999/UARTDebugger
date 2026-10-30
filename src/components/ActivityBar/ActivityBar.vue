<script setup>
import { useDark, useToggle } from '@vueuse/core'
import { Binary, Cable, Download, History, Moon, Settings2, Sun } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useDialog } from '@/components/Dialog'

const router = useRouter()
const { open } = useDialog()
const isDark = useDark()
const toggleDark = useToggle(isDark)
function history() {
  window.open(router.resolve('/record').href, '_blank')
}
</script>

<template>
  <nav class="uart-rail" aria-label="工作台导航">
    <div class="rail-emblem">
      UART
    </div>
    <button class="rail-button selected" aria-label="串口工作台">
      <Cable /><span>工作台</span>
    </button>
    <button class="rail-button" aria-label="会话历史" @click="history">
      <History /><span>历史记录</span>
    </button>
    <button class="rail-button" aria-label="ASCII 码表" @click="open('ascii')">
      <Binary /><span>ASCII</span>
    </button>
    <div class="rail-spacer" />
    <button class="rail-button" aria-label="驱动帮助" @click="open('downLoadDriver')">
      <Download /><span>驱动帮助</span>
    </button>
    <button class="rail-button" aria-label="切换主题" @click="toggleDark()">
      <Sun v-if="isDark" /><Moon v-else /><span>{{ isDark ? '浅色主题' : '深色主题' }}</span>
    </button>
    <button class="rail-button" aria-label="软件设置" @click="open('setting')">
      <Settings2 /><span>设置</span>
    </button>
  </nav>
</template>
