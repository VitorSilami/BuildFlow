import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FolderKanban, PauseCircle, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Progress, Spinner } from '../components/ui'
import { AtividadeRdoChart } from '../features/dashboard/AtividadeRdoChart'
import { StatusDonutChart } from '../features/dashboard/StatusDonutChart'
import { useDashboard } from '../features/dashboard/dashboardApi'
import { execucaoCorClasse, formatExecucao } from '../lib/format'

interface TileResumoProps {
  label: string
  valor: string | number
  icon: ReactNode
}

function TileResumo({ label, valor, icon }: TileResumoProps) {
  return (
    <div className="rounded-md border border-dashed border-border p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-1 text-3xl font-bold text-ink">{valor}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()

  return (
    <main aria-label="Dashboard">
      <div className="relative overflow-hidden rounded-lg">
        <div className="grid-blueprint absolute inset-0 opacity-10" aria-hidden="true" />
        <div className="relative">
          <PageHeader title="Dashboard" breadcrumbs={[{ label: 'Dashboard' }]} />
        </div>
      </div>

      {isLoading && <Spinner label="Carregando dashboard…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar o dashboard." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo">
            <TileResumo
              label="Projetos ativos"
              valor={data.projetos_ativos}
              icon={<FolderKanban className="text-primary" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Pausados"
              valor={data.projetos_pausados}
              icon={<PauseCircle className="text-amber-500" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Concluídos"
              valor={data.projetos_concluidos}
              icon={<CheckCircle2 className="text-slate-500" size={18} aria-hidden="true" />}
            />
            <TileResumo
              label="Execução média"
              valor={formatExecucao(data.execucao_media)}
              icon={<TrendingUp className="text-emerald-500" size={18} aria-hidden="true" />}
            />
          </div>

          <Card
            title="RDOs por dia"
            eyebrow={
              <>
                <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
                Últimos 7 dias
              </>
            }
          >
            <AtividadeRdoChart dados={data.atividade_rdo} />
          </Card>

          {data.projetos_ativos + data.projetos_pausados + data.projetos_concluidos > 0 && (
            <Card title="Distribuição de status" eyebrow="Projetos">
              <StatusDonutChart
                ativos={data.projetos_ativos}
                pausados={data.projetos_pausados}
                concluidos={data.projetos_concluidos}
              />
            </Card>
          )}

          {data.alertas.length > 0 && (
            <Card title="Alertas de RDO">
              <ul aria-label="Alertas de RDO atrasado" className="flex flex-col gap-3">
                {data.alertas.map((alerta) => (
                  <li key={alerta.projeto_id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="text-destructive" size={16} aria-hidden="true" />
                      <Link
                        to={`/projetos/${alerta.projeto_id}/registros-diarios/novo`}
                        className="font-medium text-primary hover:underline"
                      >
                        {alerta.projeto_nome}
                      </Link>
                    </span>
                    <Badge variant="destructive">
                      {alerta.dias_sem_rdo === null
                        ? 'Nunca registrado'
                        : `${alerta.dias_sem_rdo} dias sem RDO`}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.projetos.length === 0 ? (
            <EmptyState>
              Nenhum projeto ativo ainda.{' '}
              <Link to="/projetos" className="font-medium text-primary hover:underline">
                Crie um projeto para começar.
              </Link>
            </EmptyState>
          ) : (
            <Card title="Projetos ativos">
              <ul aria-label="Lista de projetos ativos" className="flex flex-col gap-3">
                {data.projetos.map((projeto) => (
                  <li key={projeto.id} className="flex items-center justify-between gap-4">
                    <Link
                      to={`/projetos/${projeto.id}/registros-diarios`}
                      className="font-medium text-primary hover:underline"
                    >
                      {projeto.nome}
                    </Link>
                    {projeto.execucao_percentual === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <div className="flex w-32 items-center gap-2">
                        <Progress
                          value={Number(projeto.execucao_percentual)}
                          indicatorClassName={execucaoCorClasse(projeto.execucao_percentual)}
                        />
                        <span className="w-12 text-right text-sm text-muted-foreground">
                          {formatExecucao(projeto.execucao_percentual)}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
