import type { ReactNode } from 'react'

interface EmptyStateProps {
  children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}
