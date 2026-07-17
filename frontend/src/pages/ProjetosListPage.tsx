import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'
import { ProjetoForm } from '../features/projetos/ProjetoForm'
import { useProjetos } from '../features/projetos/projetosApi'

export function ProjetosListPage() {
  const { data, isLoading, isError, refetch } = useProjetos()
  const [showForm, setShowForm] = useState(false)

  return (
    <main aria-label="Projetos">
      <PageHeader
        title="Projetos"
        breadcrumbs={[{ label: 'Projetos' }]}
        actions={
          <button type="button" className="btn btn-primary d-flex align-items-center gap-2" onClick={() => setShowForm((current) => !current)}>
            <Plus size={16} aria-hidden="true" />
            {showForm ? 'Cancelar' : 'Novo Projeto'}
          </button>
        }
      />

      {showForm && (
        <Card title="Criar novo projeto">
          <ProjetoForm onCreated={() => setShowForm(false)} />
        </Card>
      )}

      {isLoading && <Spinner label="Carregando projetos…" />}

      {isError && (
        <Alert>
          <p className="mb-2">Não foi possível carregar os projetos.</p>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </Alert>
      )}

      {!isLoading && !isError && data?.results.length === 0 && (
        <p className="text-muted">Nenhum projeto ainda. Crie o primeiro projeto para começar.</p>
      )}

      {!isLoading && !isError && data && data.results.length > 0 && (
        <div className="row" aria-label="Lista de projetos">
          {data.results.map((projeto) => (
            <div className="col-12 col-md-6 col-lg-4" key={projeto.id}>
              <Card title={projeto.nome}>
                {projeto.descricao && <p>{projeto.descricao}</p>}
                <div className="d-flex gap-3">
                  <Link to={`/projetos/${projeto.id}/registros-diarios`}>Registros diários</Link>
                  <Link to={`/projetos/${projeto.id}/configuracoes`}>Configurações</Link>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
