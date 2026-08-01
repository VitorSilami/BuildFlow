import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AppStatCard, AppStatusBadge, Button, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { CATEGORIA_LABELS } from '../features/rnc/categoriaItens'
import { useRncs } from '../features/rnc/rncApi'
import {
  STATUS_EFETIVO_ICON,
  STATUS_EFETIVO_LABEL,
  STATUS_EFETIVO_TONE,
} from '../features/rnc/statusEfetivoBadge'
import type { Rnc } from '../types/rnc'

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

function CardRnc({ rnc, projetoId }: { rnc: Rnc; projetoId: string }) {
  const StatusIcon = STATUS_EFETIVO_ICON[rnc.status_efetivo]
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
      <AppStatusBadge
        tone={STATUS_EFETIVO_TONE[rnc.status_efetivo]}
        label={STATUS_EFETIVO_LABEL[rnc.status_efetivo]}
        icon={<StatusIcon size={12} aria-hidden="true" />}
      />
    </Link>
  )
}

export function RncListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'RNCs' }])
  const { user } = useAuth()
  const [filtroStatus, setFiltroStatus] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const ehGerente = user?.perfil === 'gerente'

  const rncs = useRncs(projetoId ?? '', {
    status: filtroStatus || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
  })

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
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="rnc-data-inicio" className="text-xs text-muted-foreground">
                De
              </label>
              <input
                id="rnc-data-inicio"
                type="date"
                value={dataInicio}
                max={dataFim || undefined}
                onChange={(event) => setDataInicio(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="rnc-data-fim" className="text-xs text-muted-foreground">
                Até
              </label>
              <input
                id="rnc-data-fim"
                type="date"
                value={dataFim}
                min={dataInicio || undefined}
                onChange={(event) => setDataFim(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            {(dataInicio || dataFim) && (
              <Button
                variant="outline"
                onClick={() => {
                  setDataInicio('')
                  setDataFim('')
                }}
              >
                Limpar período
              </Button>
            )}
            <Button asChild>
              <Link to={`/projetos/${projetoId}/rncs/novo`}>Nova RNC</Link>
            </Button>
          </div>
        }
      />

      {rncs.isLoading && <RncListSkeleton />}

      {rncs.isError && (
        <ErrorRetry message="Não foi possível carregar as RNCs." onRetry={() => void rncs.refetch()} />
      )}

      {!rncs.isLoading && !rncs.isError && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <AppStatCard label="Total de RNCs" value={total} />
            <AppStatCard label="Em aberto" value={emAberto} tone="warning" />
            <AppStatCard label="Prazo excedido" value={prazoExcedido} tone="danger" />
            <AppStatCard label="Reincidentes" value={reincidentes} />
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
