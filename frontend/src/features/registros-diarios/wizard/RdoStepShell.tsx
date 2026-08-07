import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RdoMetricTone = 'neutral' | 'success' | 'warning' | 'danger'

const METRIC_CLASS: Record<RdoMetricTone, string> = {
  neutral: 'border-border bg-background text-ink',
  success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
}

interface RdoStepShellProps {
  label: string
  title: string
  description: string
  metrics?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function RdoStepShell({ label, title, description, metrics, actions, children }: RdoStepShellProps) {
  return (
    <section aria-label={label} className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {metrics && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics}</div>}
      {children}
    </section>
  )
}

interface RdoMetricProps {
  label: string
  value: string | number
  tone?: RdoMetricTone
}

export function RdoMetric({ label, value, tone = 'neutral' }: RdoMetricProps) {
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', METRIC_CLASS[tone])}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  )
}

interface RdoSectionProps {
  title: string
  description?: string
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function RdoSection({ title, description, icon, actions, children, className }: RdoSectionProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-background p-4', className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
            {description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

interface RdoEmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  children?: ReactNode
}

export function RdoEmptyState({ title, description, icon, children }: RdoEmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/40 p-5 text-center">
      {icon && <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  )
}
