import { Link, useParams } from 'react-router-dom'
import { FotoUpload } from '../features/registros-diarios/FotoUpload'
import { useRegistroDiario } from '../features/registros-diarios/registrosDiariosApi'

export function RegistroDiarioDetailPage() {
  const { projetoId, registroId } = useParams<{ projetoId: string; registroId: string }>()
  const { data: registro, isLoading, isError, refetch } = useRegistroDiario(registroId)

  if (isLoading) return <p role="status">Carregando…</p>

  if (isError || !registro) {
    return (
      <div role="alert">
        <p>Não foi possível carregar o registro diário.</p>
        <button type="button" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <main aria-label="Detalhe do registro diário">
      <header>
        <h1>
          Registro diário — {registro.data_referencia}
        </h1>
        <Link to={`/projetos/${projetoId}/registros-diarios`}>Voltar para a lista</Link>
      </header>

      <section aria-label="Gerais">
        <p>Turno: {registro.turno}</p>
        <p>Clima: {registro.clima}</p>
      </section>

      <section aria-label="Produção">
        <h2>Produção</h2>
        <ul>
          {registro.producoes.map((producao, index) => (
            <li key={index}>
              {producao.rodovia} — km {producao.km_inicial} a {producao.km_final} —{' '}
              {producao.quantidade}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Presenças">
        <h2>Equipe</h2>
        <ul>
          {registro.presencas.map((presenca, index) => (
            <li key={index}>
              {presenca.nome_avulso || presenca.pessoa} — {presenca.funcao} ({presenca.status})
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Máquinas">
        <h2>Máquinas</h2>
        <ul>
          {registro.maquinas.map((maquina, index) => (
            <li key={index}>
              {maquina.identificacao_avulsa || maquina.maquina} — {maquina.horas_produtivas}h
              produtivas / {maquina.horas_paradas}h paradas
            </li>
          ))}
        </ul>
      </section>

      {registro.ocorrencias.length > 0 && (
        <section aria-label="Ocorrências">
          <h2>Ocorrências</h2>
          <ul>
            {registro.ocorrencias.map((ocorrencia, index) => (
              <li key={index}>
                {ocorrencia.tipo}: {ocorrencia.descricao}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Fotos">
        <h2>Fotos</h2>
        {registro.fotos.length === 0 && <p>Nenhuma foto anexada ainda.</p>}
        <ul>
          {registro.fotos.map((foto) => (
            <li key={foto.id}>
              <img src={foto.arquivo} alt="" width={120} />
              {foto.km && <span> — km {foto.km}</span>}
            </li>
          ))}
        </ul>
        <FotoUpload registroId={registro.id} />
      </section>
    </main>
  )
}
