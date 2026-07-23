import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton, Textarea } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { AprovacaoDonutChart } from '../features/registros-diarios/AprovacaoDonutChart'
import {
  useAprovarRegistroDiario,
  useRegistrosDiarios,
  useRejeitarRegistroDiario,
} from '../features/registros-diarios/registrosDiariosApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { STATUS_REGISTRO_COR_TEXTO as COR_STATUS, STATUS_REGISTRO_LABEL as LABEL_STATUS } from '../features/registros-diarios/statusRegistroBadge'
import { toast } from '../hooks/use-toast'
import { formatData, formatDataHora } from '../lib/format'
import type { RegistroDiario, StatusRegistro } from '../types/registroDiario'

function mesAtualFiltro(): string {
  return new Date().toISOString().slice(0, 7)
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

interface TileHistoricoProps {
  label: string
  valor: string
  cor?: string
  corFundo?: string
}

function TileHistorico({ label, valor, cor, corFundo }: TileHistoricoProps) {
  return (
    <div className={`rounded-lg border p-4 ${corFundo ?? 'border-dashed border-border'}`}>
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-xl font-bold ${cor ?? 'text-ink'}`}>{valor}</p>
    </div>
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
        <span
          className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[registro.status]}`}
        >
          {LABEL_STATUS[registro.status]}
        </span>
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
  const [mes, setMes] = useState(mesAtualFiltro())
  const [filtroStatus, setFiltroStatus] = useState<StatusRegistro | ''>('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null)
  const [motivoTexto, setMotivoTexto] = useState('')

  const registros = useRegistrosDiarios(projetoId ?? '', { mes })
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
          <input
            type="month"
            aria-label="Mês de referência"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
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
              <TileHistorico
                label="Aguardando aprovação"
                valor={String(aguardando)}
                cor="text-amber-600"
                corFundo="border-amber-500/30 bg-amber-500/5"
              />
              <TileHistorico
                label="Aprovados"
                valor={String(aprovados)}
                cor="text-emerald-600"
                corFundo="border-emerald-500/30 bg-emerald-500/5"
              />
              <TileHistorico
                label="Rejeitados"
                valor={String(rejeitados)}
                cor="text-red-600"
                corFundo="border-red-500/30 bg-red-500/5"
              />
              <TileHistorico label="Taxa de aprovação" valor={`${taxaAprovacao}%`} />
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
