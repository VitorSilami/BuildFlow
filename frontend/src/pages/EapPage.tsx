import { useParams } from 'react-router-dom'
import { ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { EapWorkspace } from '../features/configuracoes/EapWorkspace'
import { useConfiguracaoProjeto } from '../features/configuracoes/configuracaoApi'
import { useProjetoBreadcrumbs } from '../features/projetos/useProjetoBreadcrumbs'
import { useConfiguracaoRdo } from '../features/registros-diarios/registrosDiariosApi'

function EapSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando...
      </span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, indice) => (
            <Skeleton key={indice} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </>
  )
}

export function EapPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')
  const configuracaoRdo = useConfiguracaoRdo(projetoId ?? '')
  const breadcrumbs = useProjetoBreadcrumbs(projetoId, [
    { label: 'Planejamento' },
    { label: 'EAP e Cronograma' },
  ])

  if (configuracao.isLoading) return <EapSkeleton />

  if (configuracao.isError || !configuracao.data) {
    return (
      <ErrorRetry
        message="Não foi possível carregar a EAP do projeto."
        onRetry={() => void configuracao.refetch()}
      />
    )
  }

  const { disciplinas, soma_pesos_disciplinas: somaPesos } = configuracao.data

  return (
    <main aria-label="EAP e cronograma">
      <PageHeader title="EAP e Cronograma" breadcrumbs={breadcrumbs} />
      <EapWorkspace
        projetoId={projetoId ?? ''}
        disciplinas={disciplinas}
        somaPesos={somaPesos}
        unidades={configuracaoRdo.data?.unidades ?? []}
      />
    </main>
  )
}
