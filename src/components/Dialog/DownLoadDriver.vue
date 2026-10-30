<script setup>
import { dialogKeys, useDialog } from './composable'

const { visible } = useDialog()
const vendors = [
  { name: 'CH340 / CH341 · 沁恒 WCH', url: 'https://www.wch.cn/downloads/CH341SER_EXE.html' },
  { name: 'CP210x · Silicon Labs', url: 'https://www.silabs.com/software-and-tools/usb-to-uart-bridge-vcp-drivers' },
  { name: 'FT232 / FT231 · FTDI', url: 'https://ftdichip.com/drivers/vcp-drivers/' },
]
</script>

<template>
  <Dialog v-model:open="visible[dialogKeys.downLoadDriver]">
    <DialogContent class="max-w-lg">
      <DialogHeader><DialogTitle>串口驱动帮助</DialogTitle><DialogDescription>调试功能可离线使用。首次使用新芯片时，Windows 可能需要安装设备厂商的驱动。</DialogDescription></DialogHeader>
      <ol class="list-decimal pl-5 space-y-3 text-sm leading-6">
        <li>连接设备，打开 Windows 设备管理器，查看“端口（COM 和 LPT）”中的 COM 编号。</li>
        <li>如果设备带黄色感叹号，请预先安装对应芯片驱动。已安装的驱动在断网后仍可使用。</li>
        <li>关闭占用该 COM 端口的其他软件，再在工作台选择串口设备。确认波特率、数据位、校验位与停止位和设备一致。</li>
      </ol>
      <p class="text-xs text-muted-foreground">
        以下官方驱动页面需要联网，将在系统浏览器中打开：
      </p>
      <a v-for="vendor in vendors" :key="vendor.url" :href="vendor.url" target="_blank" class="device-option text-sm">{{ vendor.name }} ↗</a>
    </DialogContent>
  </Dialog>
</template>
