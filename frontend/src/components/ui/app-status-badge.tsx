import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

// hover:bg-*/15 (idêntico ao estado normal) neutraliza o hover:bg-primary/80 do
// variant "default" do Badge — sem isso, passar o mouse faria o badge piscar de
// volta pra cor primária, já que tailwind-merge só agrupa conflito entre
// classes do mesmo prefixo de variante (hover: vs sem hover: não é o mesmo
// grupo). Mesmo problema já resolvido em features/projetos/statusBadge.ts.
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral:
    'border-transparent bg-slate-500/15 text-slate-700 hover:bg-slate-500/15 dark:bg-slate-500/20 dark:text-slate-400 dark:hover:bg-slate-500/20',
  success:
    'border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  warning:
    'border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20',
  danger:
    'border-transparent bg-red-500/15 text-red-700 hover:bg-red-500/15 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/20',
}

interface AppStatusBadgeProps {
  tone: BadgeTone
  label: string
  icon?: ReactNode
  className?: string
}

export function AppStatusBadge({ tone, label, icon, className }: AppStatusBadgeProps) {
  return (
    <Badge className={cn('gap-1', TONE_CLASS[tone], className)}>
      {icon}
      {label}
    </Badge>
  )
}
