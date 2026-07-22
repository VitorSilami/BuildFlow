import { useEffect, useState } from 'react'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'destructive'
  open: boolean
}

export const TOAST_DURATION_MS = 4000
const TOAST_EXIT_ANIMATION_MS = 200

type Listener = (toasts: ToastData[]) => void

let toasts: ToastData[] = []
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener(toasts))
}

export function toast(data: Omit<ToastData, 'id' | 'open'>) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { ...data, id, open: true }]
  emit()
  return id
}

export function closeToast(id: string) {
  toasts = toasts.map((item) => (item.id === id ? { ...item, open: false } : item))
  emit()
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id)
    emit()
  }, TOAST_EXIT_ANIMATION_MS)
}

export function useToast() {
  const [state, setState] = useState<ToastData[]>(toasts)

  useEffect(() => {
    listeners.add(setState)
    return () => {
      listeners.delete(setState)
    }
  }, [])

  return { toasts: state, close: closeToast }
}
