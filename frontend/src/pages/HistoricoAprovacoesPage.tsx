import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Eye,
  FileText,
  Filter,
  ImageIcon,
  ListChecks,
  MessageSquareWarning,
  Truck,
  Users,
  XCircle,
} from 'lucide-react'
import {
  AppStatCard,
  AppStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  FormField,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import {
  useAprovarRegistroDiario,
  useRegistrosDiarios,
  useRejeitarRegistroDiario,
} from '../features/registros-diarios/registrosDiariosApi'
import {
  STATUS_REGISTRO_ICON,
  STATUS_REGISTRO_LABEL as LABEL_STATUS,
  STATUS_REGISTRO_TONE,
} from '../features/registros-diarios/statusRegistroBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { toast } from '../hooks/use-toast'
import { formatData, formatDataHora } from '../lib/format'
import type { RegistroDiario, StatusRegistro } from '../types/registroDiario'

function formatarDataLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function primeiroDiaDoMesAtual(): string {
  const hoje = new Date()
  return formatarDataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
}

function ultimoDiaDoMesAtual(): string {
  const hoje = new Date()
  return formatarDataLocal(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))
}

const FILTROS_STATUS = ['', 'aguardando_aprovacao', 'aprovado', 'rejeitado'] as const

function HistoricoSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, indice) => (
            <Skeleton key={indice} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  )
}

function calcularTaxaAprovacao(aprovados: number, rejeitados: number): number {
  const total = aprovados + rejeitados
  return total > 0 ? Math.round((aprovados / total) * 100) : 100
}

function contarAusencias(registro: RegistroDiario): number {
  return registro.presencas.filter((presenca) => presenca.status !== 'presente').length
}

function totalHorasParadas(registro: RegistroDiario): number {
  return registro.maquinas.reduce((total, maquina) => total + Number(maquina.horas_paradas || 0), 0)
}

function resumoEvidencias(registro: RegistroDiario): string {
  const ocorrencias = registro.ocorrencias.length
  const fotos = registro.fotos.length
  if (ocorrencias === 0 && fotos === 0) return 'sem evidências'
  return `${ocorrencias} ocorrência(s), ${fotos} foto(s)`
}

interface CardRegistroProps {
  projetoId: string
  registro: RegistroDiario
  souFiscal: boolean
  expandido: boolean
  rejeitando: boolean
  motivoTexto: string
  onToggleExpandir: () => void
  onIniciarRejeicao: () => void
  onCancelarRejeicao: () => void
  onMudarMotivo: (valor: string) => void
  onAprovar: () => void
  onConfirmarRejeicao: () => void
}

function CardRegistro({
  projetoId,
  registro,
  souFiscal,
  expandido,
  rejeitando,
  motivoTexto,
  onToggleExpandir,
  onIniciarRejeicao,
  onCancelarRejeicao,
  onMudarMotivo,
  onAprovar,
  onConfirmarRejeicao,
}: CardRegistroProps) {
  const podeDecidir = souFiscal && registro.status === 'aguardando_aprovacao'
  const StatusIcon = STATUS_REGISTRO_ICON[registro.status]
  const IconeExpandir = expandido ? ChevronUp : ChevronDown
  const ausencias = contarAusencias(registro)
  const horasParadas = totalHorasParadas(registro)
  const exigeAtencao = registro.ocorrencias.length > 0 || ausencias > 0 || horasParadas > 0

  return (
    <article className="rounded-lg border border-border bg-background shadow-sm transition-colors hover:border-primary/30">
      <button
        type="button"
        onClick={onToggleExpandir}
        className="flex w-full flex-col gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex-row xl:items-center xl:justify-between"
        aria-expanded={expandido}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-ink">
              {formatData(registro.data_referencia)} · {registro.turno}
            </p>
            <AppStatusBadge
              tone={STATUS_REGISTRO_TONE[registro.status]}
              label={LABEL_STATUS[registro.status]}
              icon={<StatusIcon size={12} aria-hidden="true" />}
            />
            {podeDecidir && <AppStatusBadge tone="warning" label="Sua decisão" />}
            {exigeAtencao && <AppStatusBadge tone="danger" label="Revisar evidências" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{registro.clima}</span>
            <span>{registro.equipe_nome || 'Equipe não informada'}</span>
            <span>Fiscal: {registro.fiscal_nome || registro.fiscal}</span>
          </div>
        </div>

        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary xl:justify-end">
          {expandido ? 'Ocultar análise' : 'Analisar'}
          <IconeExpandir size={16} aria-hidden="true" />
        </span>
      </button>

      {expandido && (
        <div className="border-t border-border p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-4">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md border border-dashed border-border p-3">
                  <dt className="text-xs text-muted-foreground">Enviado em</dt>
                  <dd className="mt-1 font-medium text-ink">{formatDataHora(registro.created_at)}</dd>
                </div>
                <div className="rounded-md border border-dashed border-border p-3">
                  <dt className="text-xs text-muted-foreground">
                    {registro.status === 'rejeitado' ? 'Analisado em' : 'Aprovado em'}
                  </dt>
                  <dd className="mt-1 font-medium text-ink">
                    {registro.aprovado_em ? formatDataHora(registro.aprovado_em) : '-'}
                  </dd>
                </div>
                <div className="rounded-md border border-dashed border-border p-3">
                  <dt className="text-xs text-muted-foreground">Evidências</dt>
                  <dd className="mt-1 font-medium text-ink">{resumoEvidencias(registro)}</dd>
                </div>
              </dl>

              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-lg border border-border bg-card p-3" aria-label="Produção registrada">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <ListChecks size={15} aria-hidden="true" />
                    Produção registrada
                  </p>
                  {registro.producoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma produção apontada.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {registro.producoes.slice(0, 3).map((producao) => (
                        <li key={producao.id} className="rounded-md border border-border bg-background p-2">
                          <p className="font-medium text-ink">{producao.servico_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            km {producao.km_inicial} a {producao.km_final} · {producao.quantidade}{' '}
                            {producao.unidade_sigla}
                          </p>
                        </li>
                      ))}
                      {registro.producoes.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{registro.producoes.length - 3} produção(ões)
                        </li>
                      )}
                    </ul>
                  )}
                </section>

                <section className="rounded-lg border border-border bg-card p-3" aria-label="Sinais de atenção">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <MessageSquareWarning size={15} aria-hidden="true" />
                    Sinais de atenção
                  </p>
                  <div className="grid gap-2 text-sm">
                    <span className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <AlertTriangle size={14} aria-hidden="true" />
                        Ocorrências
                      </span>
                      <strong className="text-ink">{registro.ocorrencias.length}</strong>
                    </span>
                    <span className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Users size={14} aria-hidden="true" />
                        Ausências
                      </span>
                      <strong className="text-ink">{ausencias}</strong>
                    </span>
                    <span className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Truck size={14} aria-hidden="true" />
                        Horas paradas
                      </span>
                      <strong className="text-ink">{horasParadas}h</strong>
                    </span>
                  </div>
                </section>
              </div>

              {registro.motivo_rejeicao && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                  <strong>Motivo da rejeição:</strong> {registro.motivo_rejeicao}
                </p>
              )}
            </div>

            <aside className="rounded-lg border border-border bg-card p-3" aria-label="Decisão fiscal">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ClipboardCheck size={15} aria-hidden="true" />
                Decisão fiscal
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Abra o RDO completo se precisar conferir apontamentos antes da decisão.
              </p>

              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}>
                  <Eye size={15} aria-hidden="true" />
                  Abrir RDO
                </Link>
              </Button>

              {podeDecidir && (
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  {rejeitando ? (
                    <div className="flex flex-col gap-2">
                      <Textarea
                        aria-label="Motivo da rejeição"
                        placeholder="Descreva o motivo da rejeição..."
                        value={motivoTexto}
                        onChange={(event) => onMudarMotivo(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="destructive" onClick={onConfirmarRejeicao} disabled={!motivoTexto.trim()}>
                          Confirmar rejeição
                        </Button>
                        <Button variant="outline" onClick={onCancelarRejeicao}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button onClick={onAprovar} className="w-full">
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Aprovar RDO
                      </Button>
                      <Button variant="outline" onClick={onIniciarRejeicao} className="w-full">
                        <XCircle size={15} aria-hidden="true" />
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!podeDecidir && (
                <p className="mt-4 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                  {registro.status === 'aguardando_aprovacao'
                    ? 'Somente o fiscal responsável pode aprovar ou rejeitar este RDO.'
                    : 'Este RDO já saiu da fila de decisão.'}
                </p>
              )}
            </aside>
          </div>
        </div>
      )}
    </article>
  )
}

export function HistoricoAprovacoesPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Histórico & Aprovações' }])
  const { user } = useAuth()
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMesAtual)
  const [dataFim, setDataFim] = useState(ultimoDiaDoMesAtual)
  const [filtroStatus, setFiltroStatus] = useState<StatusRegistro | ''>('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null)
  const [motivoTexto, setMotivoTexto] = useState('')

  const registros = useRegistrosDiarios(projetoId ?? '', { dataInicio, dataFim })
  const aprovar = useAprovarRegistroDiario(projetoId ?? '')
  const rejeitar = useRejeitarRegistroDiario(projetoId ?? '')

  function alternarExpandir(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id))
    setRejeitandoId(null)
  }

  function iniciarRejeicao(id: string) {
    setRejeitandoId(id)
    setMotivoTexto('')
  }

  async function aprovarRdo(id: string) {
    try {
      await aprovar.mutateAsync(id)
      toast({ title: 'RDO aprovado.', variant: 'success' })
    } catch {
      toast({ title: 'Não foi possível aprovar o RDO.', variant: 'destructive' })
    }
  }

  async function confirmarRejeicao(id: string) {
    try {
      await rejeitar.mutateAsync({ registroId: id, motivoRejeicao: motivoTexto })
      setRejeitandoId(null)
      toast({ title: 'RDO rejeitado.', variant: 'default' })
    } catch {
      toast({ title: 'Não foi possível rejeitar o RDO.', variant: 'destructive' })
    }
  }

  const lista = useMemo(() => registros.data?.results ?? [], [registros.data?.results])
  const resumo = useMemo(() => {
    const aguardando = lista.filter((registro) => registro.status === 'aguardando_aprovacao').length
    const aprovados = lista.filter((registro) => registro.status === 'aprovado').length
    const rejeitados = lista.filter((registro) => registro.status === 'rejeitado').length
    const minhaFila = lista.filter(
      (registro) => registro.status === 'aguardando_aprovacao' && String(registro.fiscal) === String(user?.id),
    ).length
    const totalOcorrencias = lista.reduce((total, registro) => total + registro.ocorrencias.length, 0)
    const taxaAprovacao = calcularTaxaAprovacao(aprovados, rejeitados)
    const proximoPendente = lista.find(
      (registro) => registro.status === 'aguardando_aprovacao' && String(registro.fiscal) === String(user?.id),
    ) ?? lista.find((registro) => registro.status === 'aguardando_aprovacao')

    return { aguardando, aprovados, rejeitados, minhaFila, totalOcorrencias, taxaAprovacao, proximoPendente }
  }, [lista, user?.id])
  const filtrados = filtroStatus ? lista.filter((registro) => registro.status === filtroStatus) : lista

  return (
    <main aria-label="Histórico e aprovações">
      <PageHeader
        title="Histórico & Aprovações"
        subtitle="Mesa fiscal para revisar RDOs, aprovar registros e documentar rejeições."
        breadcrumbs={breadcrumbs}
        actions={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <FormField id="historico-data-inicio" label="De" className="mb-0">
              <Input
                id="historico-data-inicio"
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(event) => setDataInicio(event.target.value)}
              />
            </FormField>
            <FormField id="historico-data-fim" label="Até" className="mb-0">
              <Input
                id="historico-data-fim"
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(event) => setDataFim(event.target.value)}
              />
            </FormField>
          </div>
        }
      />

      {registros.isLoading && <HistoricoSkeleton />}

      {registros.isError && (
        <ErrorRetry message="Não foi possível carregar o histórico de RDOs." onRetry={() => void registros.refetch()} />
      )}

      {!registros.isLoading && !registros.isError && (
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Mesa fiscal
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">
                  {resumo.minhaFila > 0
                    ? `${resumo.minhaFila} RDO(s) aguardam sua decisão`
                    : 'Sem RDO pendente para você'}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Use a fila para priorizar registros com ocorrência, ausência, parada de máquina ou falta de foto.
                </p>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Clock3 size={15} aria-hidden="true" />
                  Próximo RDO
                </p>
                {resumo.proximoPendente ? (
                  <button
                    type="button"
                    onClick={() => alternarExpandir(resumo.proximoPendente!.id)}
                    aria-label="Selecionar próximo RDO pendente"
                    className="mt-2 w-full rounded-md border border-border bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block font-semibold text-ink">Selecionar próximo RDO</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {resumoEvidencias(resumo.proximoPendente)}
                    </span>
                  </button>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum RDO aguardando aprovação no período.</p>
                )}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AppStatCard label="Sua fila" value={resumo.minhaFila} tone="warning" icon={<ClipboardCheck size={18} />} />
            <AppStatCard label="Aguardando aprovação" value={resumo.aguardando} tone="warning" icon={<Clock3 size={18} />} />
            <AppStatCard label="Aprovados" value={resumo.aprovados} tone="success" icon={<CheckCircle2 size={18} />} />
            <AppStatCard label="Rejeitados" value={resumo.rejeitados} tone="danger" icon={<XCircle size={18} />} />
            <AppStatCard label="Taxa de aprovação" value={`${resumo.taxaAprovacao}%`} icon={<CalendarCheck2 size={18} />} />
            <AppStatCard label="Ocorrências" value={resumo.totalOcorrencias} tone="danger" icon={<AlertTriangle size={18} />} />
            <AppStatCard label="RDOs no período" value={lista.length} icon={<FileText size={18} />} />
            <AppStatCard
              label="Fotos anexadas"
              value={lista.reduce((total, registro) => total + registro.fotos.length, 0)}
              icon={<ImageIcon size={18} />}
            />
          </div>

          <Card
            title="Fila de análise"
            eyebrow={
              <>
                <Filter size={12} aria-hidden="true" />
                {filtrados.length} de {lista.length} RDO(s)
              </>
            }
            actions={
              <div className="flex flex-wrap gap-2">
                {FILTROS_STATUS.map((valor) => (
                  <Button
                    key={valor || 'todos'}
                    size="sm"
                    variant={filtroStatus === valor ? 'default' : 'outline'}
                    onClick={() => setFiltroStatus(valor)}
                  >
                    {valor === '' ? 'Todos' : LABEL_STATUS[valor]}
                  </Button>
                ))}
              </div>
            }
            className="mb-0"
          >
            {filtrados.length === 0 ? (
              <EmptyState icon={<CalendarClock size={32} aria-hidden="true" />} title="Nenhum RDO encontrado">
                Nenhum RDO encontrado para esse filtro.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {filtrados.map((registro) => (
                  <CardRegistro
                    key={registro.id}
                    projetoId={projetoId ?? ''}
                    registro={registro}
                    souFiscal={String(registro.fiscal) === String(user?.id)}
                    expandido={expandidoId === registro.id}
                    rejeitando={rejeitandoId === registro.id}
                    motivoTexto={motivoTexto}
                    onToggleExpandir={() => alternarExpandir(registro.id)}
                    onIniciarRejeicao={() => iniciarRejeicao(registro.id)}
                    onCancelarRejeicao={() => setRejeitandoId(null)}
                    onMudarMotivo={setMotivoTexto}
                    onAprovar={() => void aprovarRdo(registro.id)}
                    onConfirmarRejeicao={() => void confirmarRejeicao(registro.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </main>
  )
}
