<script setup>
import { onUnmounted, ref } from 'vue'

const request = ref(null)
const pairing = ref(null)
const pin = ref('')
const api = window.uartDesktop
const unsubscribe = api?.onDevices((value) => {
  request.value = value
})
const unsubscribePairing = api?.onPairing((value) => {
  pairing.value = value
  pin.value = ''
})
onUnmounted(() => {
  unsubscribe?.()
  unsubscribePairing?.()
})
function select(id = '') {
  api?.selectDevice(id)
  request.value = null
}
function respond(confirmed) {
  api?.respondPairing({ confirmed, pin: pin.value })
  pairing.value = null
}
</script>

<template>
  <Dialog :open="!!request" @update:open="value => { if (!value) select() }">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ request?.kind === 'serial' ? '选择串口设备' : '选择蓝牙设备' }}</DialogTitle>
        <DialogDescription>{{ request?.kind === 'serial' ? '选择要连接的 COM 端口。设备列表会随插拔自动更新。' : '正在扫描附近的 BLE 设备，请打开设备并靠近电脑。' }}</DialogDescription>
      </DialogHeader>
      <div class="device-list">
        <button v-for="item in request?.items" :key="item.id" class="device-option" @click="select(item.id)">
          <strong>{{ item.name }}</strong><span>{{ item.detail }}</span>
        </button>
        <p v-if="!request?.items?.length" class="py-8 text-center text-muted-foreground">
          {{ request?.kind === 'serial' ? '未发现串口。请插入设备并确认已安装相应驱动。' : '正在寻找设备…' }}
        </p>
      </div>
      <Button variant="outline" @click="select()">
        取消
      </Button>
    </DialogContent>
  </Dialog>
  <Dialog :open="!!pairing" @update:open="value => { if (!value) respond(false) }">
    <DialogContent>
      <DialogHeader><DialogTitle>蓝牙配对</DialogTitle><DialogDescription>{{ pairing?.deviceId }} · {{ pairing?.pairingKind }}</DialogDescription></DialogHeader>
      <p v-if="pairing?.pin">
        请核对设备配对码：<strong>{{ pairing.pin }}</strong>
      </p>
      <Input v-if="pairing?.pairingKind === 'providePin'" v-model="pin" aria-label="蓝牙配对码" placeholder="输入设备配对码" />
      <div class="flex justify-end gap-2">
        <Button variant="outline" @click="respond(false)">
          取消
        </Button><Button @click="respond(true)">
          确认配对
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
