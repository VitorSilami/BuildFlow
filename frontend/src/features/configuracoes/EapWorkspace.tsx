import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Filter,
  GitBranch,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Target,
  TrendingUp,
  Undo2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../hooks/use-toast'
import { cn } from '../../lib/utils'
import {
  execucaoCorClasse,
  formatData,
  formatExecucao,
  statusEapLabel,
} from '../../lib/format'
import type { CatalogoServico, Disciplina, StatusEap } from '../../types/configuracao'
import type { Unidade } from '../../types/registroDiario'
import {
  AppStatCard,
  AppStatusBadge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Progress,
  SelectField,
} from '../../components/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import { GanttChart } from './GanttChart'
import { EapDisciplinaCard } from './EapDisciplinaCard'
import { ImportarEapButton } from './ImportarEapButton'
import { useAtualizarDisciplina, useCriarDisciplina } from './configuracaoApi'

const TOLERANCIA_SOMA_PESOS = 0.01

type AbaEap = 'cronograma' | 'estrutura' | 'pesos' | 'dependencias'
type FiltroStatus = 'todos' | StatusEap

const STATUS_TONE: Record<StatusEap, 'neutral' | 'success' | 'warning' | 'danger'> = {
  concluido: 'success',
  no_prazo: 'success',
  atencao: 'warning',
  critico: 'danger',
  nao_iniciado: 'neutral',
  planejado: 'neutral',
}

const ABAS: Array<{ id: AbaEap; label: string; icon: typeof CalendarDays }> = [
  { id: 'cronograma', label: 'Cronograma', icon: CalendarDays },
  { id: 'estrutura', label: 'Estrutura da EAP', icon: ListTree },
  { id: 'pesos', label: 'Pesos', icon: Target },
  { id: 'dependencias', label: 'Dependências', icon: GitBranch },
]

interface EapWorkspaceProps {
  projetoId: string
  disciplinas: Disciplina[]
  somaPesos: number
  unidades: Unidade[]
}

interface LinhaDisciplina {
  tipo: 'disciplina'
  key: string
  id: string
  nome: string
  nivel: number
  peso: string | null
  avanco: string | null
  previsto: string | null
  status: StatusEap | null
  inicio: string | null
  fim: string | null
  temFilhos: boolean
  disciplina: Disciplina
}

interface LinhaServico {
  tipo: 'servico'
  key: string
  id: string
  nome: string
  nivel: number
  peso: string | null
  avanco: string | null
  previsto: string | null
  status: StatusEap | null
  inicio: string | null
  fim: string | null
  servico: CatalogoServico
}

type LinhaEstrutura = LinhaDisciplina | LinhaServico

function numeroOuNull(valor: string | null): number | null {
  if (valor === null || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function formatPercentual(valor: number | null): string {
  if (valor === null) return '-'
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

function calcularMediaPonderada(disciplinas: Disciplina[], campo: 'avanco_percentual' | 'avanco_previsto_percentual') {
  const linhas = disciplinas
    .map((disciplina) => ({
      valor: numeroOuNull(disciplina[campo]),
      peso: numeroOuNull(disciplina.peso_percentual),
    }))
    .filter((linha): linha is { valor: number; peso: number | null } => linha.valor !== null)

  if (linhas.length === 0) return null

  const somaPesos = linhas.reduce((total, linha) => total + (linha.peso ?? 0), 0)
  if (somaPesos > 0) {
    return linhas.reduce((total, linha) => total + linha.valor * (linha.peso ?? 0), 0) / somaPesos
  }

  return linhas.reduce((total, linha) => total + linha.valor, 0) / linhas.length
}

function achatarDisciplinas(disciplinas: Disciplina[]): Disciplina[] {
  return disciplinas.flatMap((disciplina) => [disciplina, ...achatarDisciplinas(disciplina.subdisciplinas)])
}

function contarServicos(disciplinas: Disciplina[]): number {
  return disciplinas.reduce(
    (total, disciplina) => total + disciplina.servicos.length + contarServicos(disciplina.subdisciplinas),
    0,
  )
}

function filtrarDisciplinas(
  disciplinas: Disciplina[],
  termoBusca: string,
  status: FiltroStatus,
): Disciplina[] {
  const termo = termoBusca.trim().toLocaleLowerCase('pt-BR')

  return disciplinas
    .map((disciplina) => {
      const subdisciplinas = filtrarDisciplinas(disciplina.subdisciplinas, termoBusca, status)
      const nomeCombina = termo === '' || disciplina.nome.toLocaleLowerCase('pt-BR').includes(termo)
      const statusCombina = status === 'todos' || disciplina.status_eap === status
      if ((nomeCombina && statusCombina) || subdisciplinas.length > 0) {
        return { ...disciplina, subdisciplinas }
      }
      return null
    })
    .filter((disciplina): disciplina is Disciplina => disciplina !== null)
}

function statusCombina(statusAtual: StatusEap | null, status: FiltroStatus): boolean {
  return status === 'todos' || statusAtual === status
}

function linhaCombina(nome: string, statusAtual: StatusEap | null, termoBusca: string, status: FiltroStatus): boolean {
  const termo = termoBusca.trim().toLocaleLowerCase('pt-BR')
  return (termo === '' || nome.toLocaleLowerCase('pt-BR').includes(termo)) && statusCombina(statusAtual, status)
}

function montarLinhasEstrutura(
  disciplinas: Disciplina[],
  expandidas: Set<string>,
  termoBusca: string,
  status: FiltroStatus,
  nivel = 0,
): LinhaEstrutura[] {
  return disciplinas.flatMap((disciplina) => {
    const filhos = [
      ...montarLinhasEstrutura(disciplina.subdisciplinas, expandidas, termoBusca, status, nivel + 1),
      ...disciplina.servicos
        .filter((servico) => linhaCombina(servico.nome, servico.status_eap ?? null, termoBusca, status))
        .map<LinhaServico>((servico) => ({
          tipo: 'servico',
          key: `servico-${servico.id}`,
          id: servico.id,
          nome: servico.nome,
          nivel: nivel + 1,
          peso: servico.peso_percentual,
          avanco: servico.avanco_percentual,
          previsto: servico.avanco_previsto_percentual,
          status: servico.status_eap ?? null,
          inicio: servico.data_inicio_prevista ?? null,
          fim: servico.data_fim_prevista ?? null,
          servico,
        })),
    ]
    const combina = linhaCombina(disciplina.nome, disciplina.status_eap ?? null, termoBusca, status)
    const filtrando = termoBusca.trim() !== '' || status !== 'todos'
    if (!combina && filhos.length === 0) return []

    const linha: LinhaDisciplina = {
      tipo: 'disciplina',
      key: `disciplina-${disciplina.id}`,
      id: disciplina.id,
      nome: disciplina.nome,
      nivel,
      peso: disciplina.peso_percentual,
      avanco: disciplina.avanco_percentual,
      previsto: disciplina.avanco_previsto_percentual,
      status: disciplina.status_eap ?? null,
      inicio: disciplina.data_inicio_prevista ?? null,
      fim: disciplina.data_fim_prevista ?? null,
      temFilhos: disciplina.subdisciplinas.length > 0 || disciplina.servicos.length > 0,
      disciplina,
    }

    if (!linha.temFilhos || expandidas.has(disciplina.id) || filtrando) return [linha, ...filhos]
    return [linha]
  })
}

function gerarRascunhoPesos(disciplinas: Disciplina[]): Record<string, string> {
  return Object.fromEntries(disciplinas.map((disciplina) => [disciplina.id, disciplina.peso_percentual ?? '']))
}

function classeDesvio(desvio: number | null): 'neutral' | 'success' | 'warning' | 'danger' {
  if (desvio === null) return 'neutral'
  if (desvio >= 0) return 'success'
  if (desvio >= -5) return 'warning'
  return 'danger'
}

export function EapWorkspace({ projetoId, disciplinas, somaPesos, unidades }: EapWorkspaceProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaEap>('estrutura')
  const [termoBusca, setTermoBusca] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('todos')
  const [zoom, setZoom] = useState<'mes' | 'trimestre'>('mes')
  const [formNovaEtapaVisivel, setFormNovaEtapaVisivel] = useState(false)
  const [novaEtapa, setNovaEtapa] = useState('')
  const cronogramaRef = useRef<HTMLDivElement>(null)
  const criarDisciplina = useCriarDisciplina(projetoId)

  const disciplinasAchatadas = useMemo(() => achatarDisciplinas(disciplinas), [disciplinas])
  const disciplinasFiltradas = useMemo(
    () => filtrarDisciplinas(disciplinas, termoBusca, status),
    [disciplinas, termoBusca, status],
  )
  const totalServicos = useMemo(() => contarServicos(disciplinas), [disciplinas])

  const avancoRealizado = calcularMediaPonderada(disciplinas, 'avanco_percentual')
  const avancoPrevisto = calcularMediaPonderada(disciplinas, 'avanco_previsto_percentual')
  const desvio = avancoRealizado === null || avancoPrevisto === null ? null : avancoRealizado - avancoPrevisto
  const pesoForaDoAlvo = Math.abs(somaPesos - 100) > TOLERANCIA_SOMA_PESOS && somaPesos > 0
  const statusCriticos = disciplinasAchatadas.filter((disciplina) => disciplina.status_eap === 'critico').length
  const statusAtencao = disciplinasAchatadas.filter((disciplina) => disciplina.status_eap === 'atencao').length
  const temDatasPlanejadas = disciplinasFiltradas.some(
    (disciplina) => disciplina.data_inicio_prevista != null && disciplina.data_fim_prevista != null,
  )

  function criarNovaEtapa() {
    criarDisciplina.mutate(
      { nome: novaEtapa },
      {
        onSuccess: () => {
          setNovaEtapa('')
          setFormNovaEtapaVisivel(false)
        },
        onError: () => toast({ title: 'Não foi possível criar a etapa.', variant: 'destructive' }),
      },
    )
  }

  if (disciplinas.length === 0) {
    return (
      <section aria-labelledby="eap-titulo" className="space-y-4">
        <EapHeader
          onNovaEtapa={() => setFormNovaEtapaVisivel(true)}
          onEditarPesos={() => setAbaAtiva('pesos')}
          projetoId={projetoId}
        />
        {formNovaEtapaVisivel && (
          <NovaEtapaForm
            value={novaEtapa}
            onChange={setNovaEtapa}
            onCancel={() => {
              setNovaEtapa('')
              setFormNovaEtapaVisivel(false)
            }}
            onSubmit={criarNovaEtapa}
            isPending={criarDisciplina.isPending}
          />
        )}
        <EmptyState title="EAP ainda não cadastrada">
          Cadastre uma etapa, importe uma planilha ou cadastre uma disciplina na aba Disciplinas para começar a EAP.
        </EmptyState>
      </section>
    )
  }

  return (
    <section aria-labelledby="eap-titulo" className="space-y-5">
      <EapHeader
        onNovaEtapa={() => setFormNovaEtapaVisivel((valor) => !valor)}
        onEditarPesos={() => setAbaAtiva('pesos')}
        projetoId={projetoId}
      />

      {formNovaEtapaVisivel && (
        <NovaEtapaForm
          value={novaEtapa}
          onChange={setNovaEtapa}
          onCancel={() => {
            setNovaEtapa('')
            setFormNovaEtapaVisivel(false)
          }}
          onSubmit={criarNovaEtapa}
          isPending={criarDisciplina.isPending}
        />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard label="Avanço realizado" value={formatPercentual(avancoRealizado)} icon={<TrendingUp size={18} />} />
        <AppStatCard label="Avanço previsto" value={formatPercentual(avancoPrevisto)} icon={<Clock3 size={18} />} />
        <AppStatCard
          label="Desvio"
          value={desvio === null ? '-' : `${desvio > 0 ? '+' : ''}${formatPercentual(desvio)}`}
          tone={classeDesvio(desvio)}
          icon={<Target size={18} />}
        />
        <AppStatCard
          label="Peso distribuído"
          value={`${somaPesos}%`}
          tone={pesoForaDoAlvo ? 'warning' : 'success'}
          icon={<FileSpreadsheet size={18} />}
        />
      </div>

      <EapToolbar
        termoBusca={termoBusca}
        onTermoBuscaChange={setTermoBusca}
        status={status}
        onStatusChange={setStatus}
        zoom={zoom}
        onZoomChange={setZoom}
        onHoje={() => {
          setAbaAtiva('cronograma')
          window.requestAnimationFrame(() => cronogramaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
        }}
      />

      {abaAtiva !== 'cronograma' && temDatasPlanejadas && (
        <Button type="button" variant="outline" size="sm" onClick={() => setAbaAtiva('cronograma')}>
          <CalendarDays size={16} aria-hidden="true" />
          Ver cronograma (Gantt)
        </Button>
      )}

      <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-1" role="tablist" aria-label="Visões da EAP">
        {ABAS.map((aba) => {
          const Icone = aba.icon
          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              aria-selected={abaAtiva === aba.id}
              aria-controls={`eap-${aba.id}`}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                abaAtiva === aba.id && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
              )}
              onClick={() => setAbaAtiva(aba.id)}
            >
              <Icone size={16} aria-hidden="true" />
              {aba.label}
            </button>
          )
        })}
      </div>

      {abaAtiva === 'cronograma' && (
        <div id="eap-cronograma" role="tabpanel" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
            <div ref={cronogramaRef} className="overflow-x-auto rounded-lg border border-border bg-card p-3">
              <div className={cn('min-w-[760px]', zoom === 'trimestre' && 'min-w-[980px]')}>
                {temDatasPlanejadas ? (
                  <GanttChart disciplinas={disciplinasFiltradas} />
                ) : (
                  <EmptyState title="Sem datas planejadas">
                    Defina início e término nas etapas para visualizar o cronograma.
                  </EmptyState>
                )}
              </div>
            </div>
            <aside className="rounded-lg border border-border bg-card p-4" aria-label="Resumo de exceções">
              <p className="font-display text-sm font-semibold text-ink">Exceções</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Críticas</span>
                  <span className="font-mono font-semibold text-danger">{statusCriticos}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Em atenção</span>
                  <span className="font-mono font-semibold text-warning">{statusAtencao}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="font-mono font-semibold text-ink">{totalServicos}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {abaAtiva === 'estrutura' && (
        <div id="eap-estrutura" role="tabpanel" className="space-y-4">
          <EapStructureTable disciplinas={disciplinas} termoBusca={termoBusca} status={status} />
          <section className="rounded-lg border border-border bg-card p-4" aria-label="Editor detalhado da EAP">
            <div className="mb-4">
              <p className="font-display text-base font-semibold text-ink">Editor detalhado</p>
              <p className="text-sm text-muted-foreground">
                Ajuste pesos, crie subdisciplinas, cadastre serviços e revise quantidades por etapa.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {disciplinas.map((disciplina) => (
                <EapDisciplinaCard
                  key={disciplina.id}
                  projetoId={projetoId}
                  disciplina={disciplina}
                  unidades={unidades}
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      {abaAtiva === 'pesos' && (
        <div id="eap-pesos" role="tabpanel">
          <EapWeightEditor projetoId={projetoId} disciplinas={disciplinas} somaPesos={somaPesos} />
        </div>
      )}

      {abaAtiva === 'dependencias' && (
        <div id="eap-dependencias" role="tabpanel" className="rounded-lg border border-dashed border-border bg-card p-6">
          <EmptyState title="Dependências ainda não configuradas">
            O contrato atual da API ainda não expõe predecessoras, sucessoras ou caminho crítico para esta EAP.
          </EmptyState>
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        Filtros aplicados em {disciplinasFiltradas.length} etapas.
      </div>
    </section>
  )
}

function EapHeader({
  projetoId,
  onNovaEtapa,
  onEditarPesos,
}: {
  projetoId: string
  onNovaEtapa: () => void
  onEditarPesos: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Planejamento</p>
        <h2 id="eap-titulo" className="mt-1 font-display text-2xl font-bold text-ink">
          EAP e Cronograma
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Estruture, acompanhe e ajuste o planejamento físico da obra.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <ImportarEapButton projetoId={projetoId} />
        <Button type="button" onClick={onNovaEtapa}>
          <Plus size={16} aria-hidden="true" />
          Nova etapa
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Mais ações" icon={<MoreHorizontal size={16} aria-hidden="true" />} variant="outline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditarPesos}>
              <Pencil size={14} aria-hidden="true" />
              Editar pesos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function NovaEtapaForm({
  value,
  onChange,
  onCancel,
  onSubmit,
  isPending,
}: {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
  isPending: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <FormField id="nova-etapa-eap" label="Nova etapa" className="mb-0 flex-1">
          <Input id="nova-etapa-eap" value={value} onChange={(event) => onChange(event.target.value)} />
        </FormField>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={!value.trim() || isPending} onClick={onSubmit}>
            Criar etapa
          </Button>
        </div>
      </div>
    </div>
  )
}

function EapToolbar({
  termoBusca,
  onTermoBuscaChange,
  status,
  onStatusChange,
  zoom,
  onZoomChange,
  onHoje,
}: {
  termoBusca: string
  onTermoBuscaChange: (value: string) => void
  status: FiltroStatus
  onStatusChange: (value: FiltroStatus) => void
  zoom: 'mes' | 'trimestre'
  onZoomChange: (value: 'mes' | 'trimestre') => void
  onHoje: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,1fr)_220px]">
          <FormField id="buscar-etapa-eap" label="Buscar etapa" className="mb-0">
            <Input
              id="buscar-etapa-eap"
              value={termoBusca}
              onChange={(event) => onTermoBuscaChange(event.target.value)}
              placeholder="Nome da etapa ou serviço"
            />
          </FormField>
          <SelectField
            id="status-eap"
            label="Status"
            value={status}
            onChange={(value) => onStatusChange(value as FiltroStatus)}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'critico', label: 'Crítico' },
              { value: 'atencao', label: 'Atenção' },
              { value: 'no_prazo', label: 'No prazo' },
              { value: 'concluido', label: 'Concluído' },
              { value: 'planejado', label: 'Planejado' },
              { value: 'nao_iniciado', label: 'Não iniciado' },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onHoje}>
            <CalendarDays size={16} aria-hidden="true" />
            Hoje
          </Button>
          <div className="flex rounded-md border border-border p-1" aria-label="Zoom do cronograma">
            {(['mes', 'trimestre'] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                className={cn(
                  'h-8 rounded px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  zoom === opcao && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )}
                aria-pressed={zoom === opcao}
                onClick={() => onZoomChange(opcao)}
              >
                {opcao === 'mes' ? 'Mês' : 'Trimestre'}
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Filter size={14} aria-hidden="true" />
            Planejado
            <span className="h-2 w-6 rounded-full bg-planned" aria-hidden="true" />
            Realizado
            <span className="h-2 w-6 rounded-full bg-actual" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  )
}

function EapStructureTable({
  disciplinas,
  termoBusca,
  status,
}: {
  disciplinas: Disciplina[]
  termoBusca: string
  status: FiltroStatus
}) {
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set(disciplinas.map((d) => d.id)))
  const linhas = useMemo(
    () => montarLinhasEstrutura(disciplinas, expandidas, termoBusca, status),
    [disciplinas, expandidas, termoBusca, status],
  )

  function alternarDisciplina(id: string) {
    setExpandidas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(id)) proximas.delete(id)
      else proximas.add(id)
      return proximas
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <DataTable
        ariaLabel="Estrutura hierárquica da EAP"
        data={linhas}
        getRowKey={(row) => row.key}
        emptyTitle="Nenhuma etapa encontrada"
        emptyMessage="Ajuste os filtros para voltar a ver a estrutura da EAP."
        columns={[
          {
            id: 'nome',
            header: 'Etapa',
            cell: (row) => (
              <div className="flex min-w-[280px] items-center gap-2" style={{ paddingLeft: row.nivel * 20 }}>
                {row.tipo === 'disciplina' && row.temFilhos ? (
                  <IconButton
                    label={expandidas.has(row.id) ? `Recolher ${row.nome}` : `Expandir ${row.nome}`}
                    icon={
                      expandidas.has(row.id) ? (
                        <ChevronDown size={14} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={14} aria-hidden="true" />
                      )
                    }
                    size="sm"
                    variant="ghost"
                    onClick={() => alternarDisciplina(row.id)}
                  />
                ) : (
                  <span className="h-8 w-8" aria-hidden="true" />
                )}
                <span className={cn('font-medium text-ink', row.tipo === 'servico' && 'font-normal text-muted-foreground')}>
                  {row.nome}
                </span>
              </div>
            ),
          },
          { id: 'inicio', header: 'Início', cell: (row) => formatData(row.inicio), className: 'whitespace-nowrap' },
          { id: 'fim', header: 'Término', cell: (row) => formatData(row.fim), className: 'whitespace-nowrap' },
          { id: 'peso', header: 'Peso', cell: (row) => (row.peso === null ? '-' : `${row.peso}%`) },
          {
            id: 'avanco',
            header: 'Avanço',
            cell: (row) => (
              <div className="flex min-w-32 items-center gap-2">
                <Progress value={numeroOuNull(row.avanco) ?? 0} indicatorClassName={execucaoCorClasse(row.avanco)} />
                <span className="w-12 text-right font-mono text-xs text-muted-foreground">{formatExecucao(row.avanco)}</span>
              </div>
            ),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) =>
              row.status === null ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                <AppStatusBadge tone={STATUS_TONE[row.status]} label={statusEapLabel(row.status) ?? '-'} />
              ),
          },
        ]}
      />
    </div>
  )
}

function EapWeightEditor({
  projetoId,
  disciplinas,
  somaPesos,
}: {
  projetoId: string
  disciplinas: Disciplina[]
  somaPesos: number
}) {
  const [editando, setEditando] = useState(false)
  const [confirmarDescarte, setConfirmarDescarte] = useState(false)
  const [rascunho, setRascunho] = useState<Record<string, string>>(() => gerarRascunhoPesos(disciplinas))
  const atualizarDisciplina = useAtualizarDisciplina(projetoId)

  useEffect(() => {
    if (!editando) setRascunho(gerarRascunhoPesos(disciplinas))
  }, [disciplinas, editando])

  const totalRascunho = disciplinas.reduce((total, disciplina) => total + (Number(rascunho[disciplina.id]) || 0), 0)
  const alteracoes = disciplinas.filter((disciplina) => rascunho[disciplina.id] !== (disciplina.peso_percentual ?? ''))
  const temAlteracoes = alteracoes.length > 0
  const totalForaDoAlvo = Math.abs(totalRascunho - 100) > TOLERANCIA_SOMA_PESOS && totalRascunho > 0

  function cancelarEdicao() {
    if (temAlteracoes) {
      setConfirmarDescarte(true)
      return
    }
    setEditando(false)
  }

  async function salvarPesos() {
    try {
      await Promise.all(
        alteracoes.map((disciplina) =>
          atualizarDisciplina.mutateAsync({
            disciplinaId: disciplina.id,
            peso_percentual: rascunho[disciplina.id],
          }),
        ),
      )
      setEditando(false)
      toast({ title: 'Distribuição de pesos atualizada.' })
    } catch {
      toast({ title: 'Não foi possível salvar os pesos.', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-display text-base font-semibold text-ink">Distribuição de pesos</p>
          <p className="text-sm text-muted-foreground">Total distribuído: {editando ? totalRascunho : somaPesos}%</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editando ? (
            <>
              <Button type="button" variant="outline" onClick={cancelarEdicao}>
                <Undo2 size={16} aria-hidden="true" />
                Cancelar
              </Button>
              <Button type="button" disabled={!temAlteracoes || atualizarDisciplina.isPending} onClick={salvarPesos}>
                <Save size={16} aria-hidden="true" />
                Salvar alterações
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setEditando(true)}>
              <Pencil size={16} aria-hidden="true" />
              Editar distribuição
            </Button>
          )}
        </div>
      </div>

      {totalForaDoAlvo && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          A soma dos pesos das etapas principais não fecha 100%.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm" aria-label="Edição dos pesos das etapas principais">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Etapa</th>
              <th className="w-40 px-3 py-2 font-medium">Peso</th>
              <th className="w-40 px-3 py-2 font-medium">Avanço</th>
              <th className="w-40 px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {disciplinas.map((disciplina) => (
              <tr key={disciplina.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-3 font-medium text-ink">{disciplina.nome}</td>
                <td className="px-3 py-3">
                  {editando ? (
                    <Input
                      aria-label={`Peso de ${disciplina.nome}`}
                      value={rascunho[disciplina.id] ?? ''}
                      onChange={(event) =>
                        setRascunho((atual) => ({ ...atual, [disciplina.id]: event.target.value }))
                      }
                    />
                  ) : (
                    <span className="font-mono text-ink">{disciplina.peso_percentual ?? '-'}%</span>
                  )}
                </td>
                <td className="px-3 py-3">{formatExecucao(disciplina.avanco_percentual)}</td>
                <td className="px-3 py-3">
                  {disciplina.status_eap === null ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <AppStatusBadge
                      tone={STATUS_TONE[disciplina.status_eap]}
                      label={statusEapLabel(disciplina.status_eap) ?? '-'}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmarDescarte}
        onOpenChange={setConfirmarDescarte}
        title="Descartar alterações?"
        description="Os pesos editados voltarão aos valores salvos."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        destructive
        onConfirm={() => {
          setRascunho(gerarRascunhoPesos(disciplinas))
          setEditando(false)
          setConfirmarDescarte(false)
        }}
      />
    </div>
  )
}
