import { create } from 'zustand'

export interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastState {
  toasts: Toast[]
  pushToast: (type: Toast['type'], message: string) => void
  dismissToast: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  pushToast: (type, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
