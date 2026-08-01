import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppStatCard, AppStatusBadge, Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton, Textarea } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { AprovacaoDonutChart } from '../features/registros-diarios/AprovacaoDonutChart'
import {
  useAprovarRegistroDiario,
  useRegistrosDiarios,
  useRejeitarRegistroDiario,
} from '../features/registros-diarios/registrosDiariosApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import {
  STATUS_REGISTRO_ICON,
  STATUS_REGISTRO_LABEL as LABEL_STATUS,
  STATUS_REGISTRO_TONE,
} from '../features/registros-diarios/statusRegistroBadge'
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
      <span role="status" className="sr-only">Carregando…</span>
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

function calcularTaxaAprovacao(aprovados: number, rejeitados: number): number {
  const total = aprovados + rejeitados
  return total > 0 ? Math.round((aprovados / total) * 100) : 100
}

interface CardRegistroProps {
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

  return (
    <div className="mb-3 rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggleExpandir}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div>
          <p className="font-medium text-ink">
            {formatData(registro.data_referencia)} · {registro.turno}
          </p>
          <p className="text-sm text-muted-foreground">{registro.clima}</p>
        </div>
        <AppStatusBadge
          tone={STATUS_REGISTRO_TONE[registro.status]}
          label={LABEL_STATUS[registro.status]}
          icon={<StatusIcon size={12} aria-hidden="true" />}
        />
      </button>

      {expandido && (
        <div className="border-t border-border p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Enviado em: </span>
            {formatDataHora(registro.created_at)}
          </p>
          {registro.aprovado_em && (
            <p>
              <span className="text-muted-foreground">
                {registro.status === 'rejeitado' ? 'Analisado em: ' : 'Aprovado em: '}
              </span>
              {formatDataHora(registro.aprovado_em)}
            </p>
          )}
          {registro.motivo_rejeicao && (
            <p className="mt-2 rounded-md bg-red-500/10 p-2 text-red-700">
              <strong>Motivo da rejeição:</strong> {registro.motivo_rejeicao}
            </p>
          )}

          {podeDecidir && (
            <div className="mt-4">
              {rejeitando ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    aria-label="Motivo da rejeição"
                    placeholder="Descreva o motivo da rejeição..."
                    value={motivoTexto}
                    onChange={(event) => onMudarMotivo(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={onConfirmarRejeicao}
                      disabled={!motivoTexto.trim()}
                    >
                      Confirmar rejeição
                    </Button>
                    <Button variant="outline" onClick={onCancelarRejeicao}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={onAprovar}>Aprovar RDO</Button>
                  <Button variant="outline" onClick={onIniciarRejeicao}>
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
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

  const lista = registros.data?.results ?? []
  const aguardando = lista.filter((r) => r.status === 'aguardando_aprovacao').length
  const aprovados = lista.filter((r) => r.status === 'aprovado').length
  const rejeitados = lista.filter((r) => r.status === 'rejeitado').length
  const taxaAprovacao = calcularTaxaAprovacao(aprovados, rejeitados)
  const filtrados = filtroStatus ? lista.filter((r) => r.status === filtroStatus) : lista

  return (
    <main aria-label="Histórico e aprovações">
      <PageHeader
        title="Histórico & Aprovações"
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="historico-data-inicio" className="text-xs text-muted-foreground">
                De
              </label>
              <input
                id="historico-data-inicio"
                type="date"
                value={dataInicio}
                max={dataFim}
                onChange={(event) => setDataInicio(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="historico-data-fim" className="text-xs text-muted-foreground">
                Até
              </label>
              <input
                id="historico-data-fim"
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(event) => setDataFim(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
        }
      />

      {registros.isLoading && <HistoricoSkeleton />}

      {registros.isError && (
        <ErrorRetry
          message="Não foi possível carregar o histórico de RDOs."
          onRetry={() => void registros.refetch()}
        />
      )}

      {!registros.isLoading && !registros.isError && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="grid grid-cols-2 gap-4 lg:col-span-2">
              <AppStatCard label="Aguardando aprovação" value={aguardando} tone="warning" />
              <AppStatCard label="Aprovados" value={aprovados} tone="success" />
              <AppStatCard label="Rejeitados" value={rejeitados} tone="danger" />
              <AppStatCard label="Taxa de aprovação" value={`${taxaAprovacao}%`} />
            </div>
            {lista.length > 0 && (
              <Card title="Distribuição por status">
                <AprovacaoDonutChart aguardando={aguardando} aprovados={aprovados} rejeitados={rejeitados} />
              </Card>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
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

          {filtrados.length === 0 ? (
            <EmptyState>Nenhum RDO encontrado para esse filtro.</EmptyState>
          ) : (
            filtrados.map((registro) => (
              <CardRegistro
                key={registro.id}
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
            ))
          )}
        </>
      )}
    </main>
  )
}
