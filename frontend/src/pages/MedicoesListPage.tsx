import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  AppStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorRetry,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useMedicoes } from '../features/medicoes/medicoesApi'
import { NovaMedicaoModal } from '../features/medicoes/NovaMedicaoModal'
import {
  STATUS_MEDICAO_ICON,
  STATUS_MEDICAO_LABEL,
  STATUS_MEDICAO_TONE,
} from '../features/medicoes/statusMedicaoBadge'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { formatData, formatMoeda } from '../lib/format'

function MedicoesListSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </>
  )
}

export function MedicoesListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [modalAberto, setModalAberto] = useState(false)
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Medições' }])
  const { data: medicoes, isLoading, isError, refetch } = useMedicoes(projetoId ?? '')

  const existePendente = (medicoes ?? []).some((medicao) => medicao.status === 'aguardando_aprovacao')
  const podeCriar = user?.perfil === 'gerente'

  return (
    <main aria-label="Medições">
      <PageHeader
        title="Medições"
        breadcrumbs={breadcrumbs}
        actions={
          podeCriar ? (
            <Button
              className="gap-2"
              disabled={existePendente}
              title={existePendente ? 'Já existe uma medição aguardando aprovação.' : undefined}
              onClick={() => setModalAberto(true)}
            >
              <Plus size={16} aria-hidden="true" />
              Nova medição
            </Button>
          ) : undefined
        }
      />

      {isLoading && <MedicoesListSkeleton />}

      {isError && (
        <ErrorRetry message="Não foi possível carregar as medições." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && medicoes && medicoes.length === 0 && (
        <EmptyState>Nenhuma medição criada ainda.</EmptyState>
      )}

      {!isLoading && !isError && medicoes && medicoes.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data de corte</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fiscal</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicoes.map((medicao) => {
                const StatusIcon = STATUS_MEDICAO_ICON[medicao.status]
                return (
                  <TableRow key={medicao.id}>
                    <TableCell>
                      <Link
                        to={`/projetos/${projetoId}/medicoes/${medicao.id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {formatData(medicao.data_corte)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AppStatusBadge
                        tone={STATUS_MEDICAO_TONE[medicao.status]}
                        label={STATUS_MEDICAO_LABEL[medicao.status]}
                        icon={<StatusIcon size={12} aria-hidden="true" />}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{medicao.fiscal_nome}</TableCell>
                    <TableCell className="text-right font-semibold text-ink">
                      {formatMoeda(medicao.valor_total)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <NovaMedicaoModal projetoId={projetoId ?? ''} open={modalAberto} onOpenChange={setModalAberto} />
    </main>
  )
}
