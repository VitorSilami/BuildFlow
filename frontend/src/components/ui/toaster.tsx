import { useToast, TOAST_DURATION_MS } from '../../hooks/use-toast'
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast'

export function Toaster() {
  const { toasts, close } = useToast()

  return (
    <ToastProvider duration={TOAST_DURATION_MS}>
      {toasts.map(({ id, title, description, variant, open }) => (
        <Toast
          key={id}
          variant={variant}
          open={open}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) close(id)
          }}
        >
          <div className="grid gap-1">
            <ToastTitle className="flex items-center gap-2">
              {variant === 'success' && (
                <span className="font-mono text-signal" aria-hidden="true">
                  [✓]
                </span>
              )}
              {title}
            </ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
