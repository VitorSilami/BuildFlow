import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'blocked'

const TONE_VALUE_CLASS: Record<StatTone, string> = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
  blocked: 'text-blocked',
}

const TONE_CONTAINER_CLASS: Record<StatTone, string> = {
  neutral: 'border-border bg-card',
  success: 'border-success/25 bg-success/5',
  warning: 'border-warning/30 bg-warning/10',
  danger: 'border-danger/25 bg-danger/5',
  info: 'border-info/25 bg-info/5',
  blocked: 'border-blocked/25 bg-blocked/5',
}

interface AppStatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  tone?: StatTone
}

export function AppStatCard({ label, value, icon, tone = 'neutral' }: AppStatCardProps) {
  return (
    <div className={cn('rounded-lg border p-4 shadow-sm', TONE_CONTAINER_CLASS[tone])}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {icon && <span className={cn('text-muted-foreground', TONE_VALUE_CLASS[tone])}>{icon}</span>}
      </div>
      <p className={cn('mt-1 font-display text-2xl font-bold', TONE_VALUE_CLASS[tone])}>{value}</p>
    </div>
  )
}
