import { Calendar, FolderPlus, MapPin, Pencil, Plus, Search, SearchX, Settings, User } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorRetry,
  Input,
  PageHeader,
  Progress,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { STATUS_BADGE_CLASS, STATUS_LABEL } from '../features/projetos/statusBadge'
import { useProjetos } from '../features/projetos/projetosApi'
import { formatData, formatExecucao } from '../lib/format'
import type { Projeto, ProjetoStatus } from '../types/projeto'

type FiltroStatus = 'todos' | ProjetoStatus
type ModalState = 'fechado' | 'criar' | Projeto

function ProjetosListSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando projetos…</span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-3 h-3 w-1/2" />
            <Skeleton className="mt-2 h-3 w-1/3" />
            <Skeleton className="mt-4 h-2 w-full" />
          </div>
        ))}
      </div>
    </>
  )
}

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [modal, setModal] = useState<ModalState>('fechado')
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')

  const projetosFiltrados =
    data?.results.filter((projeto) => {
      const combinaStatus = filtro === 'todos' || projeto.status === filtro
      const termo = busca.trim().toLowerCase()
      const combinaBusca =
        termo === '' ||
        projeto.nome.toLowerCase().includes(termo) ||
        projeto.trecho.toLowerCase().includes(termo) ||
        projeto.engenheiro_responsavel.toLowerCase().includes(termo)
      return combinaStatus && combinaBusca
    }) ?? []

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <Button className="gap-2" onClick={() => setModal('criar')}>
            <Plus size={16} aria-hidden="true" />
            Novo Projeto
          </Button>
        }
      />

      {isLoading && <ProjetosListSkeleton />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar os projetos." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState icon={<FolderPlus size={32} aria-hidden="true" />} title="Nenhum projeto ainda">
          Crie o primeiro projeto pra começar a registrar RDOs.
        </EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)}>
              <TabsList aria-label="Filtrar por status">
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="ativo">Ativos</TabsTrigger>
                <TabsTrigger value="pausado">Pausados</TabsTrigger>
                <TabsTrigger value="concluido">Concluídos</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative max-w-sm">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, trecho ou engenheiro…"
                aria-label="Buscar projetos"
                className="pl-9"
              />
            </div>
          </div>

          {projetosFiltrados.length === 0 ? (
            <EmptyState icon={<SearchX size={32} aria-hidden="true" />} title="Nenhum projeto encontrado">
              Tente outro termo de busca ou outro filtro de status.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Lista de projetos">
              {projetosFiltrados.map((projeto) => (
                <Card
                  key={projeto.id}
                  title={projeto.nome}
                  actions={
                    <div className="flex items-center gap-2">
                      {projeto.numero_contrato && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {projeto.numero_contrato}
                        </span>
                      )}
                      <Badge className={STATUS_BADGE_CLASS[projeto.status]}>
                        {STATUS_LABEL[projeto.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${projeto.nome}`}
                        onClick={() => setModal(projeto)}
                        className="opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  }
                >
                  {projeto.descricao && <p className="mb-3 text-sm text-muted-foreground">{projeto.descricao}</p>}

                  <div className="mb-4 flex flex-col gap-2 text-sm">
                    {projeto.trecho && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin size={14} aria-hidden="true" />
                        <span>{projeto.trecho}</span>
                      </div>
                    )}
                    {projeto.engenheiro_responsavel && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User size={14} aria-hidden="true" />
                        <span>{projeto.engenheiro_responsavel}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} aria-hidden="true" />
                      <span>Último RDO: {formatData(projeto.ultimo_rdo_data)}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Execução</span>
                      <span className="font-medium text-ink">{formatExecucao(projeto.execucao_percentual)}</span>
                    </div>
                    {projeto.execucao_percentual !== null && (
                      <Progress value={Number(projeto.execucao_percentual)} className="h-2" />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild className="flex-1">
                      <Link to={`/projetos/${projeto.id}/registros-diarios`}>Abrir Projeto</Link>
                    </Button>
                    <Button asChild variant="outline" size="icon" aria-label={`Configurações de ${projeto.nome}`}>
                      <Link to={`/projetos/${projeto.id}/configuracoes`}>
                        <Settings size={16} aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={modal !== 'fechado'} onOpenChange={(open) => !open && setModal('fechado')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal === 'criar' ? 'Criar novo projeto' : 'Editar projeto'}</DialogTitle>
          </DialogHeader>
          <ProjetoForm
            projeto={modal === 'criar' || modal === 'fechado' ? undefined : modal}
            onSuccess={() => setModal('fechado')}
          />
        </DialogContent>
      </Dialog>
    </main>
  )
}
