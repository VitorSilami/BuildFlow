import type { ReactNode } from 'react'

interface AlertProps {
  children: ReactNode
  variant?: 'danger' | 'warning' | 'info'
}

export function Alert({ children, variant = 'danger' }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      {children}
    </div>
  )
}
