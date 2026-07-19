import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorRetry, PageHeader, Spinner, Tabs, TabsList, TabsTrigger } from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'
import { formatExecucao } from '../lib/format'
import type { ProjetoStatus } from '../types/projeto'

type FiltroStatus = 'todos' | ProjetoStatus

const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

const STATUS_BADGE_VARIANT: Record<ProjetoStatus, 'default' | 'secondary' | 'outline'> = {
  ativo: 'default',
  pausado: 'secondary',
  concluido: 'outline',
}

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')

  const projetosFiltrados =
    data?.results.filter((projeto) => filtro === 'todos' || projeto.status === filtro) ?? []

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <Button className="gap-2" onClick={() => setShowForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" />
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </Button>
        }
      />

      {showForm && (
        <Card title="Criar novo projeto">
          <ProjetoForm onSuccess={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum projeto ainda. Crie o primeiro projeto para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <>
          <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)} className="mb-6">
            <TabsList aria-label="Filtrar por status">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativo">Ativos</TabsTrigger>
              <TabsTrigger value="pausado">Pausados</TabsTrigger>
              <TabsTrigger value="concluido">Concluídos</TabsTrigger>
            </TabsList>
          </Tabs>

          {projetosFiltrados.length === 0 ? (
            <EmptyState>Nenhum projeto neste status.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Lista de projetos">
              {projetosFiltrados.map((projeto) => (
                <Card
                  key={projeto.id}
                  title={projeto.nome}
                  actions={
                    <Badge variant={STATUS_BADGE_VARIANT[projeto.status]}>
                      {STATUS_LABEL[projeto.status]}
                    </Badge>
                  }
                >
                  {projeto.descricao && <p className="mb-3 text-sm text-muted-foreground">{projeto.descricao}</p>}
                  <dl className="mb-3 flex flex-col gap-1 text-sm">
                    {projeto.numero_contrato && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Contrato</dt>
                        <dd className="font-medium text-ink">{projeto.numero_contrato}</dd>
                      </div>
                    )}
                    {projeto.trecho && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Trecho</dt>
                        <dd className="font-medium text-ink">{projeto.trecho}</dd>
                      </div>
                    )}
                    {projeto.engenheiro_responsavel && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Engenheiro</dt>
                        <dd className="font-medium text-ink">{projeto.engenheiro_responsavel}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Execução</dt>
                      <dd className="font-medium text-ink">{formatExecucao(projeto.execucao_percentual)}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-4 text-sm">
                    <Link to={`/projetos/${projeto.id}/registros-diarios`} className="font-medium text-primary hover:underline">
                      Registros diários
                    </Link>
                    <Link to={`/projetos/${projeto.id}/configuracoes`} className="font-medium text-primary hover:underline">
                      Configurações
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
