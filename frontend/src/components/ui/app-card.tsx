import type { ReactNode } from 'react'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from './card'

interface CardProps {
  title?: string
  eyebrow?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, eyebrow, actions, children }: CardProps) {
  return (
    <ShadcnCard className="group/card mb-6">
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            {eyebrow && (
              <p className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </p>
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
