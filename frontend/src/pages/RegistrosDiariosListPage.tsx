import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, EmptyState, PageHeader, Spinner } from '../components/ui'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '')

  return (
    <main aria-label="Registros diários">
      <PageHeader
        title="Registros diários"
        breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Registros diários' }]}
        actions={
          <Button asChild className="gap-2">
            <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>
              <Plus size={16} aria-hidden="true" />
              Novo registro diário
            </Link>
          </Button>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os registros diários.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <EmptyState>Nenhum registro diário ainda. Crie o primeiro para começar.</EmptyState>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Lista de registros diários">
          {data.results.map((registro) => (
            <li key={registro.id} className="px-4 py-3 hover:bg-surface">
              <Link to={`/projetos/${projetoId}/registros-diarios/${registro.id}`} className="text-sm font-medium text-ink">
                {registro.data_referencia} — {registro.turno} — {registro.clima}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
