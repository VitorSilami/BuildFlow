import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AppStatusBadge,
  Button,
  Card,
  ErrorRetry,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
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

function MedicaoDetailSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </>
  )
}

function CampoResumo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-ink">{valor}</p>
    </div>
  )
}

export function MedicaoDetailPage() {
  const { projetoId, medicaoId } = useParams<{ projetoId: string; medicaoId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: medicao, isLoading, isError, refetch } = useMedicao(projetoId, medicaoId)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'Medições', to: `/projetos/${projetoId}/medicoes` },
    { label: medicao ? formatData(medicao.data_corte) : '…' },
  ])

  const aprovar = useAprovarMedicao(projetoId ?? '')
  const rejeitar = useRejeitarMedicao(projetoId ?? '')
  const cancelar = useCancelarMedicao(projetoId ?? '')
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (isLoading) return <MedicaoDetailSkeleton />

  if (isError || !medicao) {
    return <ErrorRetry message="Não foi possível carregar a medição." onRetry={() => void refetch()} />
  }

  // user.id chega como string do allauth mas fiscal/criado_por sao numero (PK
  // Django) — String() dos dois lados evita falso-negativo, mesmo padrao ja
  // usado em HistoricoAprovacoesPage pro fiscal do RDO.
  const souFiscal = String(medicao.fiscal) === String(user?.id)
  const souCriadorOuGerente =
    String(medicao.criado_por) === String(user?.id) || user?.perfil === 'gerente'
  const pendente = medicao.status === 'aguardando_aprovacao'
  const StatusIcon = STATUS_MEDICAO_ICON[medicao.status]

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
        breadcrumbs={breadcrumbs}
        actions={
          <AppStatusBadge
            tone={STATUS_MEDICAO_TONE[medicao.status]}
            label={STATUS_MEDICAO_LABEL[medicao.status]}
            icon={<StatusIcon size={12} aria-hidden="true" />}
          />
        }
      />

      <Card title="Resumo">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <CampoResumo label="Fiscal" valor={medicao.fiscal_nome} />
          <CampoResumo label="Criado em" valor={formatDataHora(medicao.created_at)} />
          {medicao.aprovado_em && (
            <CampoResumo
              label={medicao.status === 'rejeitado' ? 'Analisado em' : 'Aprovado em'}
              valor={formatDataHora(medicao.aprovado_em)}
            />
          )}
          <CampoResumo label="Valor total" valor={formatMoeda(medicao.valor_total)} />
        </div>
        {medicao.motivo_rejeicao && (
          <p className="mt-4 rounded-md bg-red-500/10 p-2 text-sm text-red-700">
            <strong>Motivo da rejeição:</strong> {medicao.motivo_rejeicao}
          </p>
        )}
        {medicao.quantidade_itens_sem_preco > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {medicao.quantidade_itens_sem_preco} serviço(s) sem preço não entram no total.
          </p>
        )}
      </Card>

      <Card title="Itens" eyebrow={`${medicao.itens.length} serviço(s)`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Qtd. anterior</TableHead>
              <TableHead className="text-right">Qtd. acumulada</TableHead>
              <TableHead className="text-right">Qtd. do período</TableHead>
              <TableHead className="text-right">Preço unitário</TableHead>
              <TableHead className="text-right">Valor do período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {medicao.itens.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium text-ink">{item.servico_nome}</p>
                  <p className="text-xs text-muted-foreground">{item.disciplina_nome}</p>
                </TableCell>
                <TableCell className="text-right">{item.quantidade_anterior}</TableCell>
                <TableCell className="text-right">{item.quantidade_acumulada}</TableCell>
                <TableCell className="text-right font-semibold text-ink">
                  {item.quantidade_periodo}
                </TableCell>
                <TableCell className="text-right">
                  {item.preco_unitario_snapshot === null ? '—' : formatMoeda(item.preco_unitario_snapshot)}
                </TableCell>
                <TableCell className="text-right">
                  {item.valor_periodo === null ? '—' : formatMoeda(item.valor_periodo)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {pendente && souFiscal && (
        <Card title="Aprovação">
          {rejeitando ? (
            <div className="flex flex-col gap-2">
              <Textarea
                aria-label="Motivo da rejeição"
                placeholder="Descreva o motivo da rejeição..."
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="destructive" onClick={() => void confirmarRejeicao()} disabled={!motivo.trim()}>
                  Confirmar rejeição
                </Button>
                <Button variant="outline" onClick={() => setRejeitando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => void aprovarMedicao()}>Aprovar medição</Button>
              <Button variant="outline" onClick={() => setRejeitando(true)}>
                Rejeitar
              </Button>
            </div>
          )}
        </Card>
      )}

      {pendente && souCriadorOuGerente && (
        <Button variant="outline" className="mt-4" onClick={() => void cancelarMedicao()}>
          Cancelar medição
        </Button>
      )}
    </main>
  )
}
