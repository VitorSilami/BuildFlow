import type { ReactNode } from 'react'
import { Label } from './label'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  children: ReactNode
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
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
