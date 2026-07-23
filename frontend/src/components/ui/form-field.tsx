import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  className?: string
  children: ReactNode
}

export function FormField({ id, label, error, className, children }: FormFieldProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
