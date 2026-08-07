import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  Plus,
  UserRound,
} from 'lucide-react'
import { AppStatusBadge, Badge, Button, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useMedicoes } from '../features/medicoes/medicoesApi'
import { NovaMedicaoModal } from '../features/medicoes/NovaMedicaoModal'
import {
  STATUS_MEDICAO_ICON,
  STATUS_MEDICAO_LABEL,
  STATUS_MEDICAO_TONE,
} from '../features/medicoes/statusMedicaoBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { formatData, formatMoeda } from '../lib/format'
import type { Medicao } from '../types/medicao'
import type { BadgeTone } from '../components/ui'

function MedicoesListSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, indice) => (
            <Skeleton key={indice} className="h-56 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function resumoMedicoes(lista: Medicao[]) {
  const aguardando = lista.filter((medicao) => medicao.status === 'aguardando_aprovacao').length
  const aprovadas = lista.filter((medicao) => medicao.status === 'aprovado').length
  const rejeitadas = lista.filter((medicao) => medicao.status === 'rejeitado').length
  const valorTotal = lista.reduce((soma, medicao) => soma + Number(medicao.valor_total || 0), 0)
  const itens = lista.reduce((total, medicao) => total + medicao.itens.length, 0)
  const semPreco = lista.reduce((total, medicao) => total + medicao.quantidade_itens_sem_preco, 0)
  const proximaPendente = lista.find((medicao) => medicao.status === 'aguardando_aprovacao') ?? null

  return { aguardando, aprovadas, rejeitadas, valorTotal, itens, semPreco, proximaPendente }
}

function MetricTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail?: string
  tone?: BadgeTone
}) {
  const toneClass: Record<BadgeTone, string> = {
    neutral: 'border-border bg-card text-ink',
    success: 'border-success/25 bg-success/5 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    danger: 'border-danger/25 bg-danger/5 text-danger',
    info: 'border-info/25 bg-info/5 text-info',
    blocked: 'border-blocked/25 bg-blocked/5 text-blocked',
  }

  return (
    <div className={`rounded-lg border p-3 ${toneClass[tone]}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function MedicaoCard({ medicao, projetoId }: { medicao: Medicao; projetoId: string | undefined }) {
  const StatusIcon = STATUS_MEDICAO_ICON[medicao.status]
  const temPendenciaPreco = medicao.quantidade_itens_sem_preco > 0

  return (
    <li className="group rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-cyan/45 hover:shadow-lg">
      <div className="flex min-h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Data de corte</p>
            <Link
              to={`/projetos/${projetoId}/medicoes/${medicao.id}`}
              className="mt-1 block font-display text-xl font-bold text-ink hover:text-brand-blue"
            >
              {formatData(medicao.data_corte)}
            </Link>
          </div>
          <AppStatusBadge
            tone={STATUS_MEDICAO_TONE[medicao.status]}
            label={STATUS_MEDICAO_LABEL[medicao.status]}
            icon={<StatusIcon size={12} aria-hidden="true" />}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="mt-1 font-semibold text-ink">{formatMoeda(medicao.valor_total)}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">Itens</p>
            <p className="mt-1 font-semibold text-ink">{medicao.itens.length} serviço(s)</p>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <UserRound size={14} aria-hidden="true" />
            Fiscal: {medicao.fiscal_nome}
          </span>
          {temPendenciaPreco && (
            <span className="flex items-center gap-2 text-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              {medicao.quantidade_itens_sem_preco} item(ns) sem preço
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <Badge variant="outline">{formatData(medicao.data_corte)}</Badge>
          <Button asChild>
            <Link to={`/projetos/${projetoId}/medicoes/${medicao.id}`}>
              Abrir medição
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" size={15} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </li>
  )
}

export function MedicoesListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [modalAberto, setModalAberto] = useState(false)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Medições' }])
  const { data: medicoes, isLoading, isError, refetch } = useMedicoes(projetoId ?? '')

  const lista = useMemo(() => medicoes ?? [], [medicoes])
  const resumo = useMemo(() => resumoMedicoes(lista), [lista])
  const existePendente = resumo.aguardando > 0
  const podeCriar = user?.perfil === 'gerente'

  return (
    <main aria-label="Medições">
      <PageHeader
        title="Medições"
        subtitle="Cortes financeiros gerados a partir da produção aprovada e enviados para decisão fiscal."
        breadcrumbs={breadcrumbs}
        actions={
          podeCriar ? (
            <Button
              className="gap-2"
              disabled={existePendente}
              title={existePendente ? 'Já existe uma medição aguardando aprovação.' : undefined}
              onClick={() => setModalAberto(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Nova medição
            </Button>
          ) : undefined
        }
      />

      {isLoading && <MedicoesListSkeleton />}

      {isError && <ErrorRetry message="Não foi possível carregar as medições." onRetry={() => void refetch()} />}

      {!isLoading && !isError && (
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Mesa de medições
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">
                  {resumo.aguardando > 0
                    ? `${resumo.aguardando} medição(ões) aguardam decisão`
                    : 'Sem medição pendente'}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Acompanhe cortes, valores, itens sem preço e aprovações antes de gerar uma nova medição.
                </p>
              </div>

              <div className="rounded-lg border border-info/25 bg-info/5 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Clock size={15} aria-hidden="true" />
                  Próxima decisão
                </p>
                {resumo.proximaPendente ? (
                  <Link
                    to={`/projetos/${projetoId}/medicoes/${resumo.proximaPendente.id}`}
                    className="mt-2 flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm transition-colors hover:border-brand-cyan/45"
                  >
                    <span>
                      <span className="block font-semibold text-ink">{formatData(resumo.proximaPendente.data_corte)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatMoeda(resumo.proximaPendente.valor_total)}
                      </span>
                    </span>
                    <ArrowRight size={16} className="text-brand-blue" aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="mt-2 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
                    Nenhum corte aguardando aprovação.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo de medições">
            <MetricTile
              label="Aguardando"
              value={resumo.aguardando}
              tone={resumo.aguardando > 0 ? 'warning' : 'neutral'}
              detail="fila fiscal"
            />
            <MetricTile label="Aprovadas" value={resumo.aprovadas} tone="success" detail="liberadas" />
            <MetricTile
              label="Rejeitadas"
              value={resumo.rejeitadas}
              tone={resumo.rejeitadas > 0 ? 'danger' : 'neutral'}
              detail="com ajuste"
            />
            <MetricTile label="Valor medido" value={formatMoeda(String(resumo.valorTotal))} detail={`${resumo.itens} item(ns)`} />
          </section>

          {resumo.semPreco > 0 && (
            <section className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{resumo.semPreco} item(ns) sem preço não entram no valor total das medições.</p>
            </section>
          )}

          {lista.length === 0 ? (
            <EmptyState icon={<CalendarDays size={32} aria-hidden="true" />} title="Nenhuma medição criada ainda.">
              Gere a primeira medição quando houver RDOs aprovados e valores cadastrados.
            </EmptyState>
          ) : (
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Histórico de cortes
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold text-ink">Medições do projeto</h2>
                </div>
                <Badge variant="outline">{lista.length} medição(ões)</Badge>
              </div>
              <ul aria-label="Medições do projeto" className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {lista.map((medicao) => (
                  <MedicaoCard key={medicao.id} medicao={medicao} projetoId={projetoId} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <NovaMedicaoModal projetoId={projetoId ?? ''} open={modalAberto} onOpenChange={setModalAberto} />
    </main>
  )
}
