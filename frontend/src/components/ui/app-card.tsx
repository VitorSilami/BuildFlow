import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from './card'

interface CardProps {
  title?: string
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, eyebrow, actions, className, children }: CardProps) {
  return (
    <ShadcnCard className={cn('group/card mb-6', className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            {eyebrow && (
              <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </div>
            )}
            {title && <CardTitle className="font-display text-lg">{title}</CardTitle>}
          </div>
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  )
}
