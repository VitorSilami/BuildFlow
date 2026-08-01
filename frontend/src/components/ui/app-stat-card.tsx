import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger'

const TONE_VALUE_CLASS: Record<StatTone, string> = {
  neutral: 'text-ink',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

const TONE_CONTAINER_CLASS: Record<StatTone, string> = {
  neutral: 'border-dashed border-border',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  danger: 'border-red-500/30 bg-red-500/5',
}

interface AppStatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  tone?: StatTone
}

export function AppStatCard({ label, value, icon, tone = 'neutral' }: AppStatCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', TONE_CONTAINER_CLASS[tone])}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn('mt-1 font-display text-2xl font-bold', TONE_VALUE_CLASS[tone])}>{value}</p>
    </div>
  )
}
