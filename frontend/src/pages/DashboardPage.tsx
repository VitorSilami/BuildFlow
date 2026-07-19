import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState, ErrorRetry, PageHeader, Spinner } from '../components/ui'
import { useDashboard } from '../features/dashboard/dashboardApi'
import { formatExecucao } from '../lib/format'

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()

  return (
    <main aria-label="Dashboard">
      <PageHeader title="Dashboard" breadcrumbs={[{ label: 'Dashboard' }]} />

      {isLoading && <Spinner label="Carregando dashboard…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar o dashboard." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumo">
            <Card title="Projetos ativos">
              <p className="text-3xl font-bold text-ink">{data.projetos_ativos}</p>
            </Card>
            <Card title="Pausados">
              <p className="text-3xl font-bold text-ink">{data.projetos_pausados}</p>
            </Card>
            <Card title="Concluídos">
              <p className="text-3xl font-bold text-ink">{data.projetos_concluidos}</p>
            </Card>
            <Card title="Execução média">
              <p className="text-3xl font-bold text-ink">{formatExecucao(data.execucao_media)}</p>
            </Card>
          </div>

          {data.alertas.length > 0 && (
            <Card title="Alertas de RDO">
              <ul aria-label="Alertas de RDO atrasado" className="flex flex-col gap-3">
                {data.alertas.map((alerta) => (
                  <li key={alerta.projeto_id} className="flex items-center justify-between">
                    <Link
                      to={`/projetos/${alerta.projeto_id}/registros-diarios/novo`}
                      className="font-medium text-primary hover:underline"
                    >
                      {alerta.projeto_nome}
                    </Link>
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
                  <li key={projeto.id} className="flex items-center justify-between">
                    <Link
                      to={`/projetos/${projeto.id}/registros-diarios`}
                      className="font-medium text-primary hover:underline"
                    >
                      {projeto.nome}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatExecucao(projeto.execucao_percentual)}
                    </span>
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
