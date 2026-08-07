import type { ReactNode } from 'react'
import { AlertTriangle, Lock, RefreshCw, SearchX } from 'lucide-react'
import { Button } from './button'
import { Card } from './card'
import { Skeleton } from './skeleton'

interface StateBlockProps {
  title: string
  children: ReactNode
  icon?: ReactNode
  action?: ReactNode
  role?: 'status' | 'alert'
}

function StateBlock({ title, children, icon, action, role = 'status' }: StateBlockProps) {
  return (
    <Card className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center" role={role}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>
      </div>
      {action}
    </Card>
  )
}

interface ErrorStateProps {
  title?: string
  message: ReactNode
  onRetry?: () => void
}

export function ErrorState({ title = 'Nao foi possivel carregar', message, onRetry }: ErrorStateProps) {
  return (
    <StateBlock
      role="alert"
      title={title}
      icon={<AlertTriangle size={24} aria-hidden="true" />}
      action={
        onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Tentar novamente
          </Button>
        ) : undefined
      }
    >
      {message}
    </StateBlock>
  )
}

interface ForbiddenStateProps {
  title?: string
  message?: ReactNode
  action?: ReactNode
}

export function ForbiddenState({
  title = 'Acesso restrito',
  message = 'Seu perfil nao tem permissao para acessar esta area.',
  action,
}: ForbiddenStateProps) {
  return (
    <StateBlock title={title} icon={<Lock size={24} aria-hidden="true" />} action={action}>
      {message}
    </StateBlock>
  )
}

interface SearchEmptyStateProps {
  title?: string
  message?: ReactNode
  action?: ReactNode
}

export function SearchEmptyState({
  title = 'Nenhum resultado encontrado',
  message = 'Tente ajustar os filtros ou buscar por outro termo.',
  action,
}: SearchEmptyStateProps) {
  return (
    <StateBlock title={title} icon={<SearchX size={24} aria-hidden="true" />} action={action}>
      {message}
    </StateBlock>
  )
}

interface LoadingStateProps {
  label?: string
  rows?: number
}

export function LoadingState({ label = 'Carregando...', rows = 4 }: LoadingStateProps) {
  return (
    <>
      <span role="status" className="sr-only">
        {label}
      </span>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </>
  )
}
