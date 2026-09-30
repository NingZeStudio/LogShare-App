import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
}

export const toasts = ref<ToastItem[]>([])

let nextId = 1

export const toast = {
  show(message: string, type: ToastType = 'info', duration = 2500): number {
    const id = nextId++
    toasts.value.push({ id, message, type, duration })

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id)
      }, duration)
    }

    return id
  },

  success(message: string, duration = 2500): number {
    return toast.show(message, 'success', duration)
  },

  error(message: string, duration = 3000): number {
    return toast.show(message, 'error', duration)
  },

  info(message: string, duration = 2500): number {
    return toast.show(message, 'info', duration)
  },

  warning(message: string, duration = 2800): number {
    return toast.show(message, 'warning', duration)
  },

  dismiss(id: number): void {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }
}
