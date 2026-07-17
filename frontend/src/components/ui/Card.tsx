import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <div className="card mb-4">
      {(title || actions) && (
        <div className="card-header d-flex justify-content-between align-items-center">
          {title && <h4 className="card-title mb-0">{title}</h4>}
          {actions}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  )
}
