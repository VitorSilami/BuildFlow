import type { ReactNode } from 'react'
import { Alert as ShadcnAlert, AlertDescription } from './alert'

interface AlertProps {
  children: ReactNode
}

export function Alert({ children }: AlertProps) {
  return (
    <ShadcnAlert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </ShadcnAlert>
  )
}
