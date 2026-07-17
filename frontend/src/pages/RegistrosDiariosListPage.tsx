import { Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, PageHeader, Spinner } from '../components/ui'
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
          <Link
            to={`/projetos/${projetoId}/registros-diarios/novo`}
            className="btn btn-primary d-flex align-items-center gap-2"
          >
            <Plus size={16} aria-hidden="true" />
            Novo registro diário
          </Link>
        }
      />

      {isLoading && <Spinner label="Carregando registros…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os registros diários.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p className="text-muted">Nenhum registro diário ainda. Crie o primeiro para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul className="list-group" aria-label="Lista de registros diários">
          {data.results.map((registro) => (
            <li className="list-group-item" key={registro.id}>
              <Link to={`/projetos/${projetoId}/registros-diarios/${registro.id}`}>
                {registro.data_referencia} — {registro.turno} — {registro.clima}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
