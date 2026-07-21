import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  children: ReactNode
}

export function EmptyState({ icon, title, children }: EmptyStateProps) {
  if (!icon && !title) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  }

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center" role="status">
      {icon && <div className="text-muted-foreground/50">{icon}</div>}
      {title && <p className="font-display text-base font-semibold text-ink">{title}</p>}
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
