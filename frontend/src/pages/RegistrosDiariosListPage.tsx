import { Link, useParams } from 'react-router-dom'
import { useRegistrosDiarios } from '../features/registros-diarios/registrosDiariosApi'

export function RegistrosDiariosListPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { data, isLoading, isError, refetch } = useRegistrosDiarios(projetoId ?? '')

  return (
    <main aria-label="Registros diários">
      <header>
        <h1>Registros diários</h1>
        <Link to={`/projetos/${projetoId}/registros-diarios/novo`}>Novo registro diário</Link>
      </header>

      {isLoading && <p role="status">Carregando registros…</p>}

      {isError && (
        <div role="alert">
          <p>Não foi possível carregar os registros diários.</p>
          <button type="button" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p>Nenhum registro diário ainda. Crie o primeiro para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul aria-label="Lista de registros diários">
          {data.results.map((registro) => (
            <li key={registro.id}>
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
