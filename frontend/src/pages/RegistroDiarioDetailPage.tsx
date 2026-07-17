import { Link, useParams } from 'react-router-dom'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)

  if (isLoading) return <Spinner label="Carregando…" />

  if (isError || !registro) {
    return (
      <Alert>
        <p className="mb-2">Não foi possível carregar o registro diário.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </Alert>
    )
  }

  return (
    <main aria-label="Detalhe do registro diário">
      <PageHeader
        title={`Registro diário — ${registro.data_referencia}`}
        breadcrumbs={[
          { label: 'Projetos', to: '/projetos' },
          { label: 'Registros diários', to: `/projetos/${projetoId}/registros-diarios` },
          { label: registro.data_referencia },
        ]}
        actions={
          <Link to={`/projetos/${projetoId}/registros-diarios`} className="btn btn-outline-secondary btn-sm">
            Voltar para a lista
          </Link>
        }
      />

      <Card title="Gerais">
        <p className="mb-1">Turno: {registro.turno}</p>
        <p className="mb-0">Clima: {registro.clima}</p>
      </Card>

      <Card title="Produção">
        <ul className="list-group list-group-flush" aria-label="Produção">
          {registro.producoes.map((producao, index) => (
            <li className="list-group-item" key={index}>
              {producao.rodovia} — km {producao.km_inicial} a {producao.km_final} — {producao.quantidade}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Equipe">
        <ul className="list-group list-group-flush" aria-label="Presenças">
          {registro.presencas.map((presenca, index) => (
            <li className="list-group-item" key={index}>
              {presenca.nome_avulso || presenca.pessoa} — {presenca.funcao} ({presenca.status})
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Máquinas">
        <ul className="list-group list-group-flush" aria-label="Máquinas">
          {registro.maquinas.map((maquina, index) => (
            <li className="list-group-item" key={index}>
              {maquina.identificacao_avulsa || maquina.maquina} — {maquina.horas_produtivas}h produtivas /{' '}
              {maquina.horas_paradas}h paradas
            </li>
          ))}
        </ul>
      </Card>

      {registro.ocorrencias.length > 0 && (
        <Card title="Ocorrências">
          <ul className="list-group list-group-flush" aria-label="Ocorrências">
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li className="list-group-item" key={index}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Fotos">
        {registro.fotos.length === 0 && <p className="text-muted">Nenhuma foto anexada ainda.</p>}
        <div className="d-flex flex-wrap gap-3 mb-3" aria-label="Fotos">
          {registro.fotos.map((foto) => (
            <figure className="mb-0" key={foto.id}>
              <img src={foto.arquivo} alt="" width={120} className="rounded" />
              {foto.km && <figcaption className="small text-muted">km {foto.km}</figcaption>}
            </figure>
          ))}
        </div>
        <FotoUpload registroId={registro.id} />
      </Card>
    </main>
  )
}
