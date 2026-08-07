import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  ClipboardList,
  FolderPlus,
  MapPin,
  Pencil,
  Plus,
  Search,
  SearchX,
  Settings,
  TrendingUp,
  User,
} from 'lucide-react'
import {
  AppStatusBadge,
  Badge,
  Button,
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
import { STATUS_ICON, STATUS_LABEL, STATUS_TONE } from '../features/projetos/statusBadge'
import { useProjetos } from '../features/projetos/projetosApi'
import { execucaoCorClasse, formatData, formatExecucao } from '../lib/format'
import { cn } from '../lib/utils'
import type { Projeto, ProjetoStatus } from '../types/projeto'

type FiltroStatus = 'todos' | ProjetoStatus
type ModalState = 'fechado' | 'criar' | Projeto

const FILTROS: Array<{ value: FiltroStatus; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'concluido', label: 'Concluídos' },
]

function textoBusca(projeto: Projeto): string {
  return [
    projeto.nome,
    projeto.trecho ?? '',
    projeto.engenheiro_responsavel ?? '',
    projeto.numero_contrato ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

function ProjetoStatusIcon({ status }: { status: ProjetoStatus }) {
  const Icon = STATUS_ICON[status]
  return <Icon size={12} aria-hidden="true" />
}

function ProjetosListSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando projetos...
      </span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-20 w-full" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, indice) => (
            <Skeleton key={indice} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function carteiraResumo(projetos: Projeto[]) {
  const ativos = projetos.filter((projeto) => projeto.status === 'ativo').length
  const pausados = projetos.filter((projeto) => projeto.status === 'pausado').length
  const concluidos = projetos.filter((projeto) => projeto.status === 'concluido').length
  const semRdo = projetos.filter((projeto) => projeto.ultimo_rdo_data === null).length
  const comExecucao = projetos.filter((projeto) => projeto.execucao_percentual !== null)
  const execucaoMedia =
    comExecucao.length === 0
      ? null
      : (comExecucao.reduce((total, projeto) => total + Number(projeto.execucao_percentual), 0) / comExecucao.length)
          .toFixed(2)
          .toString()
  const menorExecucao = [...comExecucao].sort(
    (a, b) => Number(a.execucao_percentual) - Number(b.execucao_percentual),
  )[0]

  return { ativos, pausados, concluidos, semRdo, execucaoMedia, menorExecucao }
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
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    neutral: 'border-border bg-background text-ink',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300',
    danger: 'border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300',
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}

function ProjetoExecucao({ projeto }: { projeto: Projeto }) {
  if (projeto.execucao_percentual === null) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">Execução</p>
        <p className="mt-1 text-sm font-semibold text-ink">—</p>
      </div>
    )
  }

  const cor = execucaoCorClasse(projeto.execucao_percentual)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Execução</span>
        <span className={`font-semibold ${cor.replace('bg-', 'text-')}`}>{formatExecucao(projeto.execucao_percentual)}</span>
      </div>
      <Progress
        value={Number(projeto.execucao_percentual)}
        className="projeto-progress h-2"
        indicatorClassName={cn('projeto-progress-indicator', cor)}
      />
    </div>
  )
}

function statusAccentClass(status: ProjetoStatus): string {
  if (status === 'ativo') return 'bg-emerald-500'
  if (status === 'pausado') return 'bg-amber-500'
  return 'bg-slate-400'
}

function ProjetoCard({
  projeto,
  selecionado,
  onSelecionar,
  onEditar,
}: {
  projeto: Projeto
  selecionado: boolean
  onSelecionar: () => void
  onEditar: () => void
}) {
  const ultimoRdo = formatData(projeto.ultimo_rdo_data)

  return (
    <li
      className={cn(
        'projeto-row group relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm outline-none transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary/45 hover:shadow-lg focus-within:border-primary/50',
        selecionado && 'is-selected -translate-y-1 border-primary/70 bg-primary/5 shadow-lg ring-1 ring-primary/30',
      )}
      data-selected={selecionado ? 'true' : 'false'}
      onClick={onSelecionar}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', statusAccentClass(projeto.status))} aria-hidden="true" />
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />

      <div className="flex min-h-full flex-col gap-4 pl-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <AppStatusBadge
                tone={STATUS_TONE[projeto.status]}
                label={STATUS_LABEL[projeto.status]}
                icon={<ProjetoStatusIcon status={projeto.status} />}
              />
              {projeto.numero_contrato && (
                <Badge variant="outline" className="font-mono">
                  {projeto.numero_contrato}
                </Badge>
              )}
            </div>
            <Link
              to={`/projetos/${projeto.id}/registros-diarios`}
              onClick={(event) => event.stopPropagation()}
              className="block truncate font-display text-lg font-bold text-ink hover:text-primary"
            >
              {projeto.nome}
            </Link>
          </div>

          <button
            type="button"
            aria-label={`Selecionar ${projeto.nome}`}
            onClick={(event) => {
              event.stopPropagation()
              onSelecionar()
            }}
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-all',
              selecionado && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-10">
          {projeto.descricao ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{projeto.descricao}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição cadastrada.</p>
          )}
        </div>

        <div className="grid gap-2 text-xs text-muted-foreground">
          {projeto.trecho && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={13} aria-hidden="true" />
              <span className="truncate">{projeto.trecho}</span>
            </span>
          )}
          {projeto.engenheiro_responsavel && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <User size={13} aria-hidden="true" />
              <span className="truncate">{projeto.engenheiro_responsavel}</span>
            </span>
          )}
          <span className="inline-flex min-w-0 items-center gap-1">
            <Calendar size={13} aria-hidden="true" />
            <span className="truncate">Último RDO: {ultimoRdo}</span>
          </span>
        </div>

        <div className="mt-auto space-y-3">
          <ProjetoExecucao projeto={projeto} />

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-background p-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Operação</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {projeto.ultimo_rdo_data === null ? 'Sem RDO' : 'Em dia'}
              </p>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Seleção</p>
              <p className="mt-1 text-sm font-semibold text-ink">{selecionado ? 'Selecionado' : 'Disponível'}</p>
            </div>
          </div>

          <div
            className={cn(
              'projeto-row-actions flex flex-wrap items-center gap-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
              selecionado ? 'translate-y-0 opacity-100' : 'translate-y-2',
            )}
          >
            <Button asChild className="flex-1">
              <Link to={`/projetos/${projeto.id}/registros-diarios`} onClick={(event) => event.stopPropagation()}>
                Abrir Projeto
                <ArrowRight className="projeto-card-arrow" size={15} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label={`Novo RDO de ${projeto.nome}`}>
              <Link
                to={`/projetos/${projeto.id}/registros-diarios/novo`}
                onClick={(event) => event.stopPropagation()}
              >
                <ClipboardPlus size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="icon" aria-label={`Configurações de ${projeto.nome}`}>
              <Link to={`/projetos/${projeto.id}/configuracoes`} onClick={(event) => event.stopPropagation()}>
                <Settings size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${projeto.nome}`}
              onClick={(event) => {
                event.stopPropagation()
                onEditar()
              }}
              className="projeto-row-edit opacity-0 transition-opacity"
            >
              <Pencil size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [modal, setModal] = useState<ModalState>('fechado')
  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  const projetos = useMemo(() => data?.results ?? [], [data?.results])
  const resumo = useMemo(() => carteiraResumo(projetos), [projetos])
  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return projetos.filter((projeto) => {
      const combinaStatus = filtro === 'todos' || projeto.status === filtro
      const combinaBusca = termo === '' || textoBusca(projeto).includes(termo)
      return combinaStatus && combinaBusca
    })
  }, [busca, filtro, projetos])

  return (
    <main aria-label="Projetos">
      <style>
        {`
          .projeto-row:hover .projeto-row-edit,
          .projeto-row:focus-within .projeto-row-edit {
            opacity: 1;
          }
          .projeto-row[data-selected="true"] .projeto-row-edit {
            opacity: 1;
          }
          .projeto-row:hover .projeto-row-actions,
          .projeto-row:focus-within .projeto-row-actions,
          .projeto-row[data-selected="true"] .projeto-row-actions {
            opacity: 1;
            transform: translateY(0);
          }
          .projeto-row:hover .projeto-card-arrow,
          .projeto-row[data-selected="true"] .projeto-card-arrow {
            transform: translateX(3px);
          }
          .projeto-card-arrow {
            transition: transform 160ms ease;
          }
          .projeto-row:hover .projeto-progress,
          .projeto-row[data-selected="true"] .projeto-progress {
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent);
          }
        `}
      </style>

      <PageHeader
        title="Projetos"
        subtitle="Carteira de obras, avanço físico e acesso rápido à operação de cada frente."
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
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Carteira de obras</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">Comece pela primeira frente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre a obra para liberar RDO, EAP, custos, medições e aprovações.
            </p>
          </div>
          <EmptyState icon={<FolderPlus size={32} aria-hidden="true" />} title="Nenhum projeto ainda">
            Crie o primeiro projeto pra começar a registrar RDOs.
          </EmptyState>
        </section>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_34rem]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Carteira de obras
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">
                  {resumo.ativos} projeto(s) em operação
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Use esta tela para priorizar frentes, abrir RDOs e manter a configuração de cada obra no lugar certo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricTile label="Ativos" value={resumo.ativos} tone="success" detail="em operação" />
                <MetricTile
                  label="Pausados"
                  value={resumo.pausados}
                  tone={resumo.pausados > 0 ? 'warning' : 'neutral'}
                  detail="atenção"
                />
                <MetricTile label="Concluídos" value={resumo.concluidos} detail="encerrados" />
                <MetricTile
                  label="Sem RDO"
                  value={resumo.semRdo}
                  tone={resumo.semRdo > 0 ? 'danger' : 'success'}
                  detail="sem registro"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)}>
                  <TabsList aria-label="Filtrar por status">
                    {FILTROS.map((item) => (
                      <TabsTrigger key={item.value} value={item.value}>
                        {item.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Badge variant="outline">
                  {projetosFiltrados.length} de {projetos.length} projeto(s)
                </Badge>
                {resumo.execucaoMedia !== null && (
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp size={13} aria-hidden="true" />
                    Execução média {formatExecucao(resumo.execucaoMedia)}
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por nome, trecho, contrato ou engenheiro..."
                  aria-label="Buscar projetos"
                  className="pl-9"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Operação por frente
                </p>
                <h2 className="mt-1 font-display text-lg font-bold text-ink">Cards de projetos</h2>
              </div>
              {resumo.menorExecucao && (
                <span className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                  <ClipboardList size={13} aria-hidden="true" />
                  Menor avanço em destaque
                </span>
              )}
            </div>

            {projetosFiltrados.length === 0 ? (
              <EmptyState icon={<SearchX size={32} aria-hidden="true" />} title="Nenhum projeto encontrado">
                Tente outro termo de busca ou outro filtro de status.
              </EmptyState>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Lista de projetos">
                {projetosFiltrados.map((projeto) => (
                  <ProjetoCard
                    key={projeto.id}
                    projeto={projeto}
                    selecionado={selecionadoId === projeto.id}
                    onSelecionar={() => setSelecionadoId((atual) => (atual === projeto.id ? null : projeto.id))}
                    onEditar={() => setModal(projeto)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
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
