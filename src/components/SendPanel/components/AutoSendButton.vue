<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useSendStore } from '@/store/useSendStore'

const { isAutoSending, isFileSending, selectedFilePayload, send, sendData } = useSendStore()

const autoSendTime = ref(1000)
const serial = inject('serial')
const ble = inject('ble')
const disabled = computed(() => !sendData.value.length || !!selectedFilePayload.value || isFileSending.value || !(serial.connected.value || ble.connected.value))

let timer = null
let generation = 0

async function timeoutFunc(token) {
  if (!isAutoSending.value || disabled.value || token !== generation)
    return
  try {
    await send()
  }
  catch (error) {
    isAutoSending.value = false
    toast.error(error?.message || '自动发送失败')
    return
  }
  if (isAutoSending.value && autoSendTime.value > 0 && token === generation)
    timer = setTimeout(() => timeoutFunc(token), Math.max(10, Number(autoSendTime.value)))
}

watch(isAutoSending, (enabled) => {
  generation++
  if (enabled) {
    console.log('auto send enabled')
    if (autoSendTime.value <= 0)
      return
    timeoutFunc(generation)
  }
  else {
    console.log('auto send disabled')
    clearTimeout(timer)
  }
})

watch(disabled, (value) => {
  if (value)
    isAutoSending.value = false
})

// 销毁定时器防止内存泄漏
onBeforeUnmount(() => {
  clearTimeout(timer)
  isAutoSending.value = false
  timer = null
})
</script>

<template>
  <Popover>
    <PopoverTrigger as-child class="cursor-pointer text-md">
      <Button variant="ghost" :disabled="disabled">
        自动发送
      </Button>
    </PopoverTrigger>
    <PopoverContent side="top">
      <div class="grid gap-4">
        <div class="space-y-2">
          <h4 class="font-medium leading-none flex items-center justify-between">
            <div class="flex items-center">
              <span class="mr-2">
                自动发送设置
              </span>
            </div>
            <Switch id="autoSendSwitch" v-model="isAutoSending" class="cursor-pointer" :disabled="disabled || !autoSendTime || autoSendTime <= 0" />
          </h4>
          <p class="text-sm text-muted-foreground">
            {{ autoSendTime ? `启用后自动每 ${autoSendTime} 毫秒发送一次数据` : '请输入自动发送间隔时间' }}
          </p>
        </div>
        <div class="grid gap-2">
          <div class="grid grid-cols-3 items-center gap-4">
            <NumberField id="autoSendNumberField" v-model="autoSendTime" :min="10" class="col-span-2">
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput aria-label="自动发送间隔" />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <Label for="autoSendNumberField"> ms / 次</Label>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
