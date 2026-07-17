import type { ReactNode } from 'react'

interface FormFieldProps {
  id: string
  label: string
  error?: string | null
  children: ReactNode
}

export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="form-group mb-3">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-danger small mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
