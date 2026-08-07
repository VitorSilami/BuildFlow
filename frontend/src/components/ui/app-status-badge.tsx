import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'blocked'

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral:
    'border-border bg-muted text-muted-foreground hover:bg-muted',
  success:
    'border-success/20 bg-success/10 text-success hover:bg-success/10',
  warning:
    'border-warning/25 bg-warning/15 text-warning hover:bg-warning/15',
  danger:
    'border-danger/20 bg-danger/10 text-danger hover:bg-danger/10',
  info:
    'border-info/20 bg-info/10 text-info hover:bg-info/10',
  blocked:
    'border-blocked/20 bg-blocked/10 text-blocked hover:bg-blocked/10',
}

interface AppStatusBadgeProps {
  tone: BadgeTone
  label: string
  icon?: ReactNode
  className?: string
}

export function AppStatusBadge({ tone, label, icon, className }: AppStatusBadgeProps) {
  return (
    <Badge className={cn('gap-1 border font-semibold shadow-none', TONE_CLASS[tone], className)}>
      {icon}
      {label}
    </Badge>
  )
}
