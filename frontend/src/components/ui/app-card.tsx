import type { ReactNode } from 'react'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from './card'

interface CardProps {
  title?: string
  actions?: ReactNode
  children: ReactNode
}

export function Card({ title, actions, children }: CardProps) {
  return (
    <ShadcnCard className="mb-6">
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          {title && <CardTitle className="font-display text-lg">{title}</CardTitle>}
          {actions}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  )
}
