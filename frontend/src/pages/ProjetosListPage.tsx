import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'

export function ProjetosListPage() {
  const { user, logout } = useAuth()
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)

  return (
    <main>
      <header>
        <h1>Projetos</h1>
        <p>
          {user?.empresa_nome} — {user?.nome} ({user?.perfil})
        </p>
        <button type="button" onClick={() => void logout()}>
          Sair
        </button>
      </header>

      <button type="button" onClick={() => setShowForm((current) => !current)}>
        {showForm ? 'Cancelar' : 'Novo Projeto'}
      </button>

      {showForm && <ProjetoForm onCreated={() => setShowForm(false)} />}

      {isLoading && <p role="status">Carregando projetos…</p>}

      {isError && (
        <div role="alert">
          <p>Não foi possível carregar os projetos.</p>
          <button type="button" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p>Nenhum projeto ainda. Crie o primeiro projeto para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <ul aria-label="Lista de projetos">
          {data.results.map((projeto) => (
            <li key={projeto.id}>
              <strong>{projeto.nome}</strong>
              {projeto.descricao && <p>{projeto.descricao}</p>}
              <Link to={`/projetos/${projeto.id}/registros-diarios`}>Registros diários</Link>
              {' · '}
              <Link to={`/projetos/${projeto.id}/configuracoes`}>Configurações</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
