<script setup>
import { computed, inject } from 'vue'

const serial = inject('serial')
const ble = inject('ble')
const connected = computed(() => serial.connected.value || ble.connected.value)
const version = window.uartDesktop?.version || '1.0.1'
</script>

<template>
  <header class="workbench-header">
    <div class="workbench-brand">
      <span class="brand-mark">U<span>_</span></span><div><strong>UART <span>DEBUGGER</span></strong><p>串口调试工作台</p></div>
    </div>
    <div class="header-meta">
      <span class="local-badge"><i />离线可用</span><span class="connection-badge" :class="{ active: connected }">{{ connected ? '设备已连接' : '等待设备连接' }}</span><span class="header-version">v{{ version }}</span>
    </div>
  </header>
</template>
