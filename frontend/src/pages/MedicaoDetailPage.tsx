import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileWarning,
  UserRound,
  XCircle,
} from 'lucide-react'
import {
  AppStatusBadge,
  Button,
  Card,
  DataTable,
  ErrorRetry,
  PageHeader,
  Skeleton,
  Textarea,
  type DataTableColumn,
} from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import {
  useAprovarMedicao,
  useCancelarMedicao,
  useMedicao,
  useRejeitarMedicao,
} from '../features/medicoes/medicoesApi'
import {
  STATUS_MEDICAO_ICON,
  STATUS_MEDICAO_LABEL,
  STATUS_MEDICAO_TONE,
} from '../features/medicoes/statusMedicaoBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { toast } from '../hooks/use-toast'
import { formatData, formatDataHora, formatMoeda } from '../lib/format'
import type { ItemMedicao } from '../types/medicao'

function MedicaoDetailSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </>
  )
}

function InfoTile({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? 'border-info/30 bg-info/5' : 'border-border bg-surface'}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-ink">{valor}</p>
    </div>
  )
}

function somarValorItens(itens: ItemMedicao[]): number {
  return itens.reduce((total, item) => total + Number(item.valor_periodo ?? 0), 0)
}

export function MedicaoDetailPage() {
  const { projetoId, medicaoId } = useParams<{ projetoId: string; medicaoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: medicao, isLoading, isError, refetch } = useMedicao(projetoId, medicaoId)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'Medições', to: `/projetos/${projetoId}/medicoes` },
    { label: medicao ? formatData(medicao.data_corte) : '...' },
  ])

  const aprovar = useAprovarMedicao(projetoId ?? '')
  const rejeitar = useRejeitarMedicao(projetoId ?? '')
  const cancelar = useCancelarMedicao(projetoId ?? '')
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')

  const columns: DataTableColumn<ItemMedicao>[] = useMemo(
    () => [
      {
        id: 'servico',
        header: 'Serviço',
        cell: (item) => (
          <div>
            <p className="font-medium text-ink">{item.servico_nome}</p>
            <p className="text-xs text-muted-foreground">{item.disciplina_nome}</p>
          </div>
        ),
      },
      {
        id: 'anterior',
        header: 'Qtd. anterior',
        headerClassName: 'text-right',
        className: 'text-right',
        cell: (item) => item.quantidade_anterior,
      },
      {
        id: 'acumulada',
        header: 'Qtd. acumulada',
        headerClassName: 'text-right',
        className: 'text-right',
        cell: (item) => item.quantidade_acumulada,
      },
      {
        id: 'periodo',
        header: 'Qtd. do período',
        headerClassName: 'text-right',
        className: 'text-right font-semibold text-ink',
        cell: (item) => item.quantidade_periodo,
      },
      {
        id: 'unitario',
        header: 'Preço unitário',
        headerClassName: 'text-right',
        className: 'text-right',
        cell: (item) => (item.preco_unitario_snapshot === null ? '—' : formatMoeda(item.preco_unitario_snapshot)),
      },
      {
        id: 'valor',
        header: 'Valor do período',
        headerClassName: 'text-right',
        className: 'text-right font-semibold text-ink',
        cell: (item) => (item.valor_periodo === null ? '—' : formatMoeda(item.valor_periodo)),
      },
    ],
    [],
  )

  if (isLoading) return <MedicaoDetailSkeleton />

  if (isError || !medicao) {
    return <ErrorRetry message="Não foi possível carregar a medição." onRetry={() => void refetch()} />
  }

  const souFiscal = String(medicao.fiscal) === String(user?.id)
  const souCriadorOuGerente = String(medicao.criado_por) === String(user?.id) || user?.perfil === 'gerente'
  const pendente = medicao.status === 'aguardando_aprovacao'
  const StatusIcon = STATUS_MEDICAO_ICON[medicao.status]
  const valorItens = somarValorItens(medicao.itens)

  async function aprovarMedicao() {
    try {
      await aprovar.mutateAsync(medicaoId ?? '')
      toast({ title: 'Medição aprovada.', variant: 'success' })
    } catch {
      toast({ title: 'Não foi possível aprovar a medição.', variant: 'destructive' })
    }
  }

  async function confirmarRejeicao() {
    try {
      await rejeitar.mutateAsync({ medicaoId: medicaoId ?? '', motivoRejeicao: motivo })
      setRejeitando(false)
      toast({ title: 'Medição rejeitada.', variant: 'default' })
    } catch {
      toast({ title: 'Não foi possível rejeitar a medição.', variant: 'destructive' })
    }
  }

  async function cancelarMedicao() {
    try {
      await cancelar.mutateAsync(medicaoId ?? '')
      toast({ title: 'Medição cancelada.', variant: 'default' })
      navigate(`/projetos/${projetoId}/medicoes`)
    } catch {
      toast({ title: 'Não foi possível cancelar a medição.', variant: 'destructive' })
    }
  }

  return (
    <main aria-label="Detalhe da medição">
      <PageHeader
        title={`Medição — ${formatData(medicao.data_corte)}`}
        subtitle="Conferência financeira da medição, itens medidos e decisão fiscal."
        breadcrumbs={breadcrumbs}
        actions={
          <AppStatusBadge
            tone={STATUS_MEDICAO_TONE[medicao.status]}
            label={STATUS_MEDICAO_LABEL[medicao.status]}
            icon={<StatusIcon size={12} aria-hidden="true" />}
          />
        }
      />

      <section className="mb-5 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Resumo financeiro</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink">{formatMoeda(medicao.valor_total)}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Total calculado para {medicao.itens.length} item(ns), com fiscalização atribuída a {medicao.fiscal_nome}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoTile label="Referência" valor={formatData(medicao.data_corte)} destaque />
            <InfoTile label="Fiscal" valor={medicao.fiscal_nome} />
            <InfoTile label="Itens" valor={String(medicao.itens.length)} />
            <InfoTile label="Sem preço" valor={String(medicao.quantidade_itens_sem_preco)} />
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <Card
          title="Resumo da medição"
          eyebrow={
            <>
              <ClipboardCheck size={12} aria-hidden="true" />
              Auditoria da medição
            </>
          }
          className="mb-0"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <InfoTile label="Criado em" valor={formatDataHora(medicao.created_at)} />
            <InfoTile
              label={medicao.aprovado_em ? (medicao.status === 'rejeitado' ? 'Analisado em' : 'Aprovado em') : 'Situação'}
              valor={medicao.aprovado_em ? formatDataHora(medicao.aprovado_em) : STATUS_MEDICAO_LABEL[medicao.status]}
            />
            <InfoTile label="Valor dos itens" valor={formatMoeda(String(valorItens))} />
          </div>

          {medicao.motivo_rejeicao && (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              <strong>Motivo da rejeição:</strong> {medicao.motivo_rejeicao}
            </p>
          )}
          {medicao.quantidade_itens_sem_preco > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {medicao.quantidade_itens_sem_preco} serviço(s) sem preço não entram no total.
            </p>
          )}
        </Card>

        <Card
          title="Decisão fiscal"
          eyebrow={
            <>
              <UserRound size={12} aria-hidden="true" />
              Responsável: {medicao.fiscal_nome}
            </>
          }
          className="mb-0"
        >
          {pendente && souFiscal ? (
            rejeitando ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  aria-label="Motivo da rejeição"
                  placeholder="Descreva o motivo da rejeição..."
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={() => void confirmarRejeicao()} disabled={!motivo.trim()}>
                    Confirmar rejeição
                  </Button>
                  <Button variant="outline" onClick={() => setRejeitando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Aprove a medição quando os itens e valores estiverem coerentes com os RDOs do período.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void aprovarMedicao()}>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Aprovar medição
                  </Button>
                  <Button variant="outline" onClick={() => setRejeitando(true)}>
                    <XCircle size={15} aria-hidden="true" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <p className="font-medium text-ink">Status final: {STATUS_MEDICAO_LABEL[medicao.status]}</p>
              <p className="text-sm text-muted-foreground">
                {pendente
                  ? 'Somente o fiscal responsável pode aprovar ou rejeitar esta medição.'
                  : 'Esta medição já saiu da fila de decisão.'}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Itens medidos"
        eyebrow={
          <>
            <ClipboardList size={12} aria-hidden="true" />
            {medicao.itens.length} serviço(s)
          </>
        }
      >
        <DataTable
          ariaLabel="Itens da medição"
          data={medicao.itens}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyTitle="Nenhum item medido"
          emptyMessage="A medição foi criada sem itens para este corte."
        />
      </Card>

      {pendente && souCriadorOuGerente && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={() => navigate(`/projetos/${projetoId}/medicoes`)}>
            <ArrowLeft size={15} aria-hidden="true" />
            Voltar para medições
          </Button>
          <Button variant="outline" onClick={() => void cancelarMedicao()}>
            <FileWarning size={15} aria-hidden="true" />
            Cancelar medição
          </Button>
        </div>
      )}
    </main>
  )
}
