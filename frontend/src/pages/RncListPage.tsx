import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { CATEGORIA_LABELS } from '../features/rnc/categoriaItens'
import { useRncs } from '../features/rnc/rncApi'
import type { Rnc, StatusEfetivo } from '../types/rnc'

const LABEL_STATUS_EFETIVO: Record<StatusEfetivo, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  prazo_excedido: 'Prazo excedido',
}

const COR_STATUS_EFETIVO: Record<StatusEfetivo, string> = {
  pendente: 'border-amber-500 text-amber-600',
  concluida: 'border-emerald-500 text-emerald-600',
  prazo_excedido: 'border-red-500 text-red-600',
}

function RncListSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function TileRnc({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-display text-xl font-bold ${cor ?? 'text-ink'}`}>{valor}</p>
    </div>
  )
}

function CardRnc({ rnc, projetoId }: { rnc: Rnc; projetoId: string }) {
  return (
    <Link
      to={`/projetos/${projetoId}/rncs/${rnc.id}`}
      className="mb-3 flex items-center justify-between gap-4 rounded-lg border border-border p-4 no-underline hover:bg-accent"
    >
      <div>
        <p className="font-mono text-sm font-medium text-ink">RNC-{String(rnc.numero_sequencial).padStart(3, '0')}</p>
        <p className="text-sm text-muted-foreground">
          {CATEGORIA_LABELS[rnc.categoria]} — {rnc.descricao.slice(0, 100)}
        </p>
      </div>
      <span
        className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS_EFETIVO[rnc.status_efetivo]}`}
      >
        {LABEL_STATUS_EFETIVO[rnc.status_efetivo]}
      </span>
    </Link>
  )
}

export function RncListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'RNCs' }])
  const { user } = useAuth()
  const [filtroStatus, setFiltroStatus] = useState('')
  const ehGerente = user?.perfil === 'gerente'

  const rncs = useRncs(projetoId ?? '', { status: filtroStatus || undefined })

  if (!ehGerente) {
    return (
      <main aria-label="RNCs">
        <PageHeader title="RNCs" breadcrumbs={breadcrumbs} />
        <Alert>Esta tela é restrita ao perfil Gerente.</Alert>
      </main>
    )
  }

  const lista = rncs.data ?? []
  const total = lista.length
  const emAberto = lista.filter((r) => r.status_efetivo !== 'concluida').length
  const prazoExcedido = lista.filter((r) => r.status_efetivo === 'prazo_excedido').length
  const reincidentes = lista.filter((r) => r.reincidencia).length

  return (
    <main aria-label="RNCs">
      <PageHeader
        title="RNCs"
        breadcrumbs={breadcrumbs}
        actions={
          <Button asChild>
            <Link to={`/projetos/${projetoId}/rncs/novo`}>Nova RNC</Link>
          </Button>
        }
      />

      {rncs.isLoading && <RncListSkeleton />}

      {rncs.isError && (
        <ErrorRetry message="Não foi possível carregar as RNCs." onRetry={() => void rncs.refetch()} />
      )}

      {!rncs.isLoading && !rncs.isError && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <TileRnc label="Total de RNCs" valor={String(total)} />
            <TileRnc label="Em aberto" valor={String(emAberto)} cor="text-amber-600" />
            <TileRnc label="Prazo excedido" valor={String(prazoExcedido)} cor="text-red-600" />
            <TileRnc label="Reincidentes" valor={String(reincidentes)} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(['', 'pendente', 'concluida'] as const).map((valor) => (
              <Button
                key={valor || 'todas'}
                size="sm"
                variant={filtroStatus === valor ? 'default' : 'outline'}
                onClick={() => setFiltroStatus(valor)}
              >
                {valor === '' ? 'Todas' : valor === 'pendente' ? 'Pendentes' : 'Concluídas'}
              </Button>
            ))}
          </div>

          {lista.length === 0 ? (
            <EmptyState>Nenhuma RNC encontrada.</EmptyState>
          ) : (
            lista.map((rnc) => <CardRnc key={rnc.id} rnc={rnc} projetoId={projetoId ?? ''} />)
          )}
        </>
      )}
    </main>
  )
}
