import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Filter, Plus, Repeat2, ShieldAlert } from 'lucide-react'
import {
  AppStatCard,
  AppStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  ForbiddenState,
  FormField,
  Input,
  PageHeader,
  Skeleton,
} from '../components/ui'
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
      <span role="status" className="sr-only">
        Carregando…
      </span>
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
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 no-underline shadow-sm transition-colors hover:border-brand-cyan/45 hover:bg-surface sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-bold text-ink">RNC-{String(rnc.numero_sequencial).padStart(3, '0')}</p>
          <AppStatusBadge
            tone={STATUS_EFETIVO_TONE[rnc.status_efetivo]}
            label={STATUS_EFETIVO_LABEL[rnc.status_efetivo]}
            icon={<StatusIcon size={12} aria-hidden="true" />}
          />
          {rnc.reincidencia && (
            <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
              reincidente
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-medium text-ink">{CATEGORIA_LABELS[rnc.categoria]}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{rnc.descricao}</p>
      </div>
      <dl className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:w-52">
        <div className="rounded-md border border-dashed border-border p-2">
          <dt className="text-muted-foreground">Item</dt>
          <dd className="mt-0.5 truncate font-medium text-ink">{rnc.item || '—'}</dd>
        </div>
        <div className="rounded-md border border-dashed border-border p-2">
          <dt className="text-muted-foreground">Prazo</dt>
          <dd className="mt-0.5 truncate font-medium text-ink">{rnc.data_prazo || '—'}</dd>
        </div>
      </dl>
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
        <ForbiddenState message="Esta tela é restrita ao perfil Gerente." />
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
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
            <div className="grid grid-cols-2 gap-2">
              <FormField id="rnc-data-inicio" label="De" className="mb-0">
                <Input
                  id="rnc-data-inicio"
                  type="date"
                  value={dataInicio}
                  max={dataFim || undefined}
                  onChange={(event) => setDataInicio(event.target.value)}
                />
              </FormField>
              <FormField id="rnc-data-fim" label="Até" className="mb-0">
                <Input
                  id="rnc-data-fim"
                  type="date"
                  value={dataFim}
                  min={dataInicio || undefined}
                  onChange={(event) => setDataFim(event.target.value)}
                />
              </FormField>
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
              <Link to={`/projetos/${projetoId}/rncs/novo`}>
                <Plus size={15} aria-hidden="true" />
                Nova RNC
              </Link>
            </Button>
          </div>
        }
      />

      {rncs.isLoading && <RncListSkeleton />}

      {rncs.isError && <ErrorRetry message="Não foi possível carregar as RNCs." onRetry={() => void rncs.refetch()} />}

      {!rncs.isLoading && !rncs.isError && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <AppStatCard label="Total de RNCs" value={total} icon={<ShieldAlert size={18} />} />
            <AppStatCard label="Em aberto" value={emAberto} tone="warning" icon={<AlertTriangle size={18} />} />
            <AppStatCard label="Prazo excedido" value={prazoExcedido} tone="danger" icon={<CalendarDays size={18} />} />
            <AppStatCard label="Reincidentes" value={reincidentes} icon={<Repeat2 size={18} />} />
          </div>

          <Card
            title="Registro de não conformidades"
            eyebrow={
              <>
                <Filter size={12} aria-hidden="true" />
                {lista.length} RNC(s)
              </>
            }
            actions={
              <div className="flex flex-wrap gap-2">
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
            }
            className="mb-0"
          >
            {lista.length === 0 ? (
              <EmptyState icon={<ShieldAlert size={32} aria-hidden="true" />} title="Nenhuma RNC encontrada.">
                Ajuste o período ou registre a primeira não conformidade do projeto.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {lista.map((rnc) => (
                  <CardRnc key={rnc.id} rnc={rnc} projetoId={projetoId ?? ''} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  )
}
