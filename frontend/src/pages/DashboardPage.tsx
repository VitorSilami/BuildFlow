import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  PauseCircle,
  Plus,
  TrendingUp,
} from 'lucide-react'
import { AppStatusBadge, Badge, Button, EmptyState, ErrorRetry, PageHeader, Progress, Skeleton } from '../components/ui'
import { useDashboard } from '../features/dashboard/dashboardApi'
import { execucaoCorClasse, formatExecucao } from '../lib/format'
import type { BadgeTone } from '../components/ui'
import type { DashboardAlerta, DashboardAtividadeDia, DashboardProjeto } from '../types/dashboard'

const STATUS_PROJETO_LABEL: Record<DashboardProjeto['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

const STATUS_PROJETO_TONE: Record<DashboardProjeto['status'], BadgeTone> = {
  ativo: 'success',
  pausado: 'warning',
  concluido: 'neutral',
}

function DashboardSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando dashboard...
      </span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </>
  )
}

function totalRdosSemana(atividade: DashboardAtividadeDia[]): number {
  return atividade.reduce((total, dia) => total + dia.quantidade, 0)
}

function coberturaSemana(atividade: DashboardAtividadeDia[]): number {
  if (atividade.length === 0) return 0
  const diasComRdo = atividade.filter((dia) => dia.quantidade > 0).length
  return Math.round((diasComRdo / atividade.length) * 100)
}

function labelAlerta(alerta: DashboardAlerta): string {
  return alerta.dias_sem_rdo === null ? 'Nunca registrado' : `${alerta.dias_sem_rdo} dias sem RDO`
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function prioridadeCarteira(alertas: DashboardAlerta[], pausados: number): { titulo: string; tom: BadgeTone; texto: string } {
  if (alertas.length > 0) {
    return {
      titulo: 'Atenção no apontamento',
      tom: 'danger',
      texto: `${alertas.length} frente(s) sem RDO dentro do prazo.`,
    }
  }

  if (pausados > 0) {
    return {
      titulo: 'Carteira com pausa',
      tom: 'warning',
      texto: `${pausados} projeto(s) pausado(s) para acompanhar.`,
    }
  }

  return {
    titulo: 'Operação estável',
    tom: 'success',
    texto: 'Sem alerta crítico de RDO no momento.',
  }
}

function ordenarProjetos(projetos: DashboardProjeto[], alertas: Map<string, DashboardAlerta>): DashboardProjeto[] {
  return [...projetos].sort((a, b) => {
    const alertaA = alertas.has(a.id) ? 0 : 1
    const alertaB = alertas.has(b.id) ? 0 : 1
    if (alertaA !== alertaB) return alertaA - alertaB

    const execucaoA = a.execucao_percentual === null ? 999 : Number(a.execucao_percentual)
    const execucaoB = b.execucao_percentual === null ? 999 : Number(b.execucao_percentual)
    return execucaoA - execucaoB
  })
}

function MetricTile({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail?: string
  icon: ReactNode
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
    <div className={`min-w-0 rounded-lg border p-3 shadow-sm ${toneClass[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <span>{icon}</span>
      </div>
      <p className="mt-2 truncate font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function RdoWeekStrip({ atividade }: { atividade: DashboardAtividadeDia[] }) {
  const maior = Math.max(1, ...atividade.map((dia) => dia.quantidade))

  if (atividade.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-4">
        <EmptyState icon={<ClipboardList size={32} aria-hidden="true" />} title="Sem atividade recente">
          Nenhum RDO registrado nos últimos 7 dias.
        </EmptyState>
      </div>
    )
  }

  return (
    <div aria-label="Ritmo de RDOs por dia" className="grid h-48 grid-cols-7 items-end gap-2">
      {atividade.map((dia) => {
        const altura = Math.max(8, Math.round((dia.quantidade / maior) * 100))
        return (
          <div key={dia.data} className="flex h-full min-w-0 flex-col justify-end gap-2">
            <div className="flex h-full items-end rounded-md bg-surface px-1">
              <div
                className="w-full rounded-t bg-brand-blue transition-all"
                style={{ height: `${altura}%` }}
                title={`${dia.quantidade} RDO(s) em ${diaCurto(dia.data)}`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-ink">{dia.quantidade}</p>
              <p className="truncate text-[11px] text-muted-foreground">{diaCurto(dia.data)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProjetoProgresso({ projeto }: { projeto: DashboardProjeto }) {
  const cor = execucaoCorClasse(projeto.execucao_percentual)

  if (projeto.execucao_percentual === null) {
    return <span className="text-sm font-medium text-muted-foreground">—</span>
  }

  return (
    <div className="grid min-w-40 grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
      <Progress value={Number(projeto.execucao_percentual)} indicatorClassName={cor} />
      <span className={`text-right text-sm font-semibold ${cor.replace('bg-', 'text-')}`}>
        {formatExecucao(projeto.execucao_percentual)}
      </span>
    </div>
  )
}

function ProjetoLinha({
  projeto,
  alerta,
}: {
  projeto: DashboardProjeto
  alerta?: DashboardAlerta
}) {
  return (
    <li>
      <Link
        to={`/projetos/${projeto.id}/registros-diarios`}
        className="grid gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-brand-cyan/45 hover:bg-surface lg:grid-cols-[minmax(0,1fr)_9rem_14rem_9rem_auto] lg:items-center"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{projeto.nome}</span>
          <span className="text-xs text-muted-foreground">
            {alerta ? labelAlerta(alerta) : 'Calendário de RDOs em dia'}
          </span>
        </span>
        <AppStatusBadge tone={STATUS_PROJETO_TONE[projeto.status]} label={STATUS_PROJETO_LABEL[projeto.status]} />
        <ProjetoProgresso projeto={projeto} />
        <span className="text-sm text-muted-foreground">{alerta ? 'RDO pendente' : 'Sem alerta'}</span>
        <span className="flex items-center gap-1 text-sm font-medium text-brand-blue lg:justify-end">
          Abrir
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </Link>
    </li>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()

  const resumo = useMemo(() => {
    if (!data) {
      return {
        totalProjetos: 0,
        totalRdos: 0,
        cobertura: 0,
        alertasPorProjeto: new Map<string, DashboardAlerta>(),
        projetosOrdenados: [] as DashboardProjeto[],
        prioridade: prioridadeCarteira([], 0),
      }
    }

    const alertasPorProjeto = new Map(data.alertas.map((alerta) => [alerta.projeto_id, alerta]))

    return {
      totalProjetos: data.projetos_ativos + data.projetos_pausados + data.projetos_concluidos,
      totalRdos: totalRdosSemana(data.atividade_rdo),
      cobertura: coberturaSemana(data.atividade_rdo),
      alertasPorProjeto,
      projetosOrdenados: ordenarProjetos(data.projetos, alertasPorProjeto),
      prioridade: prioridadeCarteira(data.alertas, data.projetos_pausados),
    }
  }, [data])

  return (
    <main aria-label="Dashboard">
      <PageHeader
        title="Dashboard"
        subtitle="Pulso da carteira, RDOs pendentes e avanço das frentes em uma visão de comando."
        breadcrumbs={[{ label: 'Dashboard' }]}
        actions={
          <Button asChild>
            <Link to="/projetos">
              <Plus size={16} aria-hidden="true" />
              Projeto
            </Link>
          </Button>
        }
      />

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar o dashboard." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,31rem)] xl:items-stretch">
              <div className="min-w-0 flex flex-col justify-between gap-6">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Pulso da operação
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl font-bold text-ink">{resumo.prioridade.titulo}</h2>
                    <AppStatusBadge
                      tone={resumo.prioridade.tom}
                      label={data.alertas.length > 0 ? 'RDO em risco' : 'Monitorado'}
                    />
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{resumo.prioridade.texto}</p>
                </div>

                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-4">
                  <MetricTile
                    label="Alertas"
                    value={data.alertas.length}
                    detail="frentes sem RDO"
                    tone={data.alertas.length > 0 ? 'danger' : 'success'}
                    icon={<AlertTriangle size={17} aria-hidden="true" />}
                  />
                  <MetricTile
                    label="Execução média"
                    value={formatExecucao(data.execucao_media)}
                    detail="carteira"
                    icon={<TrendingUp size={17} aria-hidden="true" />}
                  />
                  <MetricTile
                    label="RDOs/7 dias"
                    value={resumo.totalRdos}
                    detail={`${resumo.cobertura}% de cobertura`}
                    icon={<ClipboardList size={17} aria-hidden="true" />}
                  />
                  <MetricTile
                    label="Projetos"
                    value={resumo.totalProjetos}
                    detail={`${data.projetos_ativos} ativos`}
                    icon={<FolderKanban size={17} aria-hidden="true" />}
                  />
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-border bg-surface p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <CalendarCheck2 size={16} aria-hidden="true" />
                  Próxima ação recomendada
                </p>
                {data.alertas[0] ? (
                  <Link
                    to={`/projetos/${data.alertas[0].projeto_id}/registros-diarios/novo`}
                    className="mt-3 block rounded-lg border border-danger/25 bg-danger/5 p-4 transition-colors hover:border-danger/45"
                  >
                    <span className="block truncate font-display text-xl font-bold text-ink">
                      {data.alertas[0].projeto_nome}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{labelAlerta(data.alertas[0])}</span>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-blue">
                      Criar RDO agora
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </Link>
                ) : (
                  <div className="mt-3 rounded-lg border border-success/20 bg-success/5 p-4">
                    <p className="font-display text-xl font-bold text-ink">Fila limpa</p>
                    <p className="mt-1 text-sm text-muted-foreground">Nenhuma frente atrasada para registrar RDO.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    <BarChart3 size={12} aria-hidden="true" />
                    Últimos 7 dias
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-ink">Ritmo de campo</h3>
                </div>
                <Badge variant="outline">{resumo.totalRdos} RDO(s)</Badge>
              </div>
              <RdoWeekStrip atividade={data.atividade_rdo} />
            </section>

            <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    <AlertTriangle size={12} aria-hidden="true" />
                    Apontamento
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-ink">Fila crítica</h3>
                </div>
                <Badge variant={data.alertas.length > 0 ? 'destructive' : 'outline'}>{data.alertas.length}</Badge>
              </div>

              {data.alertas.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={32} aria-hidden="true" />} title="Fila limpa">
                  Todas as frentes monitoradas estão com RDO em dia.
                </EmptyState>
              ) : (
                <ul aria-label="Alertas de RDO atrasado" className="flex flex-col gap-2">
                  {data.alertas.map((alerta) => (
                    <li key={alerta.projeto_id}>
                      <Link
                        to={`/projetos/${alerta.projeto_id}/registros-diarios/novo`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 transition-colors hover:border-danger/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{alerta.projeto_nome}</span>
                          <span className="text-xs text-muted-foreground">Criar RDO pendente</span>
                        </span>
                        <Badge variant="destructive" className="shrink-0">
                          {labelAlerta(alerta)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Carteira de obras
                </p>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">Radar de projetos</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
                  <FolderKanban size={13} aria-hidden="true" />
                  {data.projetos_ativos} ativos
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
                  <PauseCircle size={13} aria-hidden="true" />
                  {data.projetos_pausados} pausados
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-muted-foreground">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {data.projetos_concluidos} concluídos
                </span>
              </div>
            </div>

            {data.projetos.length === 0 ? (
              <EmptyState icon={<FolderKanban size={32} aria-hidden="true" />} title="Nenhum projeto ativo">
                Crie um projeto para começar a registrar RDOs.{' '}
                <Link to="/projetos" className="font-medium text-brand-blue hover:underline">
                  Ir para Projetos
                </Link>
              </EmptyState>
            ) : (
              <ul aria-label="Lista de projetos ativos" className="flex flex-col gap-2">
                {resumo.projetosOrdenados.map((projeto) => (
                  <ProjetoLinha
                    key={projeto.id}
                    projeto={projeto}
                    alerta={resumo.alertasPorProjeto.get(projeto.id)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
