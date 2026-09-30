<script setup lang="ts">
/**
 * 确认弹窗
 *
 * 用来取代原生 window.confirm()：
 * - 原生弹窗在 Android WebView 里会顶出系统对话框、不跟随应用主题，且阻塞 JS 线程；
 * - 原生弹窗无法承载"删除后不可撤销"这类说明文字，也没有加载态，
 *   删除接口在慢网络下点击后毫无反馈，容易被重复点击。
 */
import AppDialog from './AppDialog.vue'
import AppButton from './AppButton.vue'
import {
  PhWarning as WarningIcon,
  PhQuestion as QuestionIcon,
  PhSpinnerGap as SpinnerIcon
} from '@phosphor-icons/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** 补充说明，会随标题一起居中展示 */
    description?: string
    confirmText?: string
    cancelText?: string
    /** 危险操作：图标与确认按钮转为告警色 */
    danger?: boolean
    /** 确认进行中：按钮转圈并禁用，避免重复提交 */
    busy?: boolean
  }>(),
  {
    description: '',
    confirmText: '确认',
    cancelText: '取消',
    danger: false,
    busy: false
  }
)

const emit = defineEmits<{
  confirm: []
  close: []
}>()

function onConfirm() {
  if (props.busy) return
  emit('confirm')
}

function onClose() {
  // 请求进行中不响应遮罩/ESC 关闭：此时关闭会让调用方的异步流程失去 UI 落点
  if (props.busy) return
  emit('close')
}
</script>

<template>
  <AppDialog
    :open="open"
    width="sm"
    :show-close="false"
    :close-on-backdrop="!busy"
    :aria-label="title"
    @close="onClose"
  >
    <div class="p-5 sm:p-6">
      <div class="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          :class="danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'"
        >
          <component
            :is="danger ? WarningIcon : QuestionIcon"
            weight="duotone"
            class="h-5 w-5"
          />
        </div>

        <div class="min-w-0 flex-1 space-y-1">
          <h3 class="text-base font-bold text-foreground">{{ title }}</h3>
          <p v-if="description" class="text-sm leading-relaxed text-muted-foreground">
            {{ description }}
          </p>
        </div>
      </div>

      <!-- 移动端纵向堆叠且取消在上（误触成本更低），桌面端回到「取消左 / 确认右」 -->
      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <AppButton
          variant="outline"
          class="touch-h w-full sm:w-auto"
          :disabled="busy"
          @click="onClose"
        >
          {{ cancelText }}
        </AppButton>
        <AppButton
          :variant="danger ? 'destructive' : 'primary'"
          class="touch-h w-full sm:w-auto"
          :disabled="busy"
          @click="onConfirm"
        >
          <SpinnerIcon v-if="busy" weight="duotone" class="h-4 w-4 animate-spin" />
          {{ confirmText }}
        </AppButton>
      </div>
    </div>
  </AppDialog>
</template>
