import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useConfiguracaoProjeto,
  useCriarDisciplina,
  useCriarEquipe,
  useCriarMaquina,
  useCriarMeta,
  useCriarPessoa,
  useCriarValorCusto,
} from '../features/configuracoes/configuracaoApi'
import { Alert, Card, PageHeader, Spinner } from '../components/ui'

export function ConfiguracaoPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const configuracao = useConfiguracaoProjeto(projetoId ?? '')

  const criarDisciplina = useCriarDisciplina(projetoId ?? '')
  const criarEquipe = useCriarEquipe(projetoId ?? '')
  const criarPessoa = useCriarPessoa(projetoId ?? '')
  const criarMaquina = useCriarMaquina(projetoId ?? '')
  const criarMeta = useCriarMeta(projetoId ?? '')
  const criarValorCusto = useCriarValorCusto(projetoId ?? '')

  const [nomeDisciplina, setNomeDisciplina] = useState('')
  const [nomeEquipe, setNomeEquipe] = useState('')
  const [pessoaNome, setPessoaNome] = useState('')
  const [pessoaFuncao, setPessoaFuncao] = useState('')
  const [pessoaEquipeId, setPessoaEquipeId] = useState('')
  const [maquinaCodigo, setMaquinaCodigo] = useState('')
  const [maquinaNome, setMaquinaNome] = useState('')
  const [maquinaEquipeId, setMaquinaEquipeId] = useState('')
  const [metaDisciplinaId, setMetaDisciplinaId] = useState('')
  const [metaValorAlvo, setMetaValorAlvo] = useState('')
  const [metaPeso, setMetaPeso] = useState('')
  const [valorTipo, setValorTipo] = useState<'mao_de_obra' | 'equipamento'>('mao_de_obra')
  const [valorDescricao, setValorDescricao] = useState('')
  const [valorValor, setValorValor] = useState('')

  if (configuracao.isLoading) return <Spinner label="Carregando…" />
  if (configuracao.isError || !configuracao.data) {
    return (
      <Alert>
        <p className="mb-2">Não foi possível carregar a configuração do projeto.</p>
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void configuracao.refetch()}>
          Tentar novamente
        </button>
      </Alert>
    )
  }

  const { disciplinas, equipes, metas, valores_custo: valoresCusto, soma_pesos_metas: somaPesos } =
    configuracao.data

  return (
    <main aria-label="Configurações do projeto">
      <PageHeader title="Configurações" breadcrumbs={[{ label: 'Projetos', to: '/projetos' }, { label: 'Configurações' }]} />

      <Card title="Disciplinas">
        <div aria-label="Disciplinas">
          {disciplinas.length === 0 && <p className="text-muted">Nenhuma disciplina cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {disciplinas.map((disciplina) => (
              <li className="list-group-item" key={disciplina.id}>
                {disciplina.nome}
              </li>
            ))}
          </ul>
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label htmlFor="nova-disciplina" className="form-label">
                Nova disciplina
              </label>
              <input
                id="nova-disciplina"
                className="form-control"
                value={nomeDisciplina}
                onChange={(event) => setNomeDisciplina(event.target.value)}
              />
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => criarDisciplina.mutate(nomeDisciplina, { onSuccess: () => setNomeDisciplina('') })}
                disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
              >
                Adicionar disciplina
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Metas">
        <div aria-label="Metas">
          {metas.length === 0 && <p className="text-muted">Nenhuma meta cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {metas.map((meta) => (
              <li className="list-group-item" key={meta.id}>
                {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
                {meta.peso_percentual ? ` (${meta.peso_percentual}%)` : ''}
              </li>
            ))}
          </ul>
          <p className="text-muted">
            Soma dos pesos: {somaPesos}%{' '}
            {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && '(atenção: não fecha 100%)'}
          </p>

          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label htmlFor="meta-disciplina" className="form-label">
                Disciplina
              </label>
              <select
                id="meta-disciplina"
                className="form-select"
                value={metaDisciplinaId}
                onChange={(event) => setMetaDisciplinaId(event.target.value)}
              >
                <option value="">Selecione…</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="meta-valor" className="form-label">
                Valor alvo
              </label>
              <input id="meta-valor" className="form-control" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
            </div>
            <div className="col-md-2">
              <label htmlFor="meta-peso" className="form-label">
                Peso (%)
              </label>
              <input id="meta-peso" className="form-control" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!metaDisciplinaId || !metaValorAlvo || criarMeta.isPending}
                onClick={() =>
                  criarMeta.mutate(
                    {
                      disciplina: metaDisciplinaId,
                      unidade: disciplinas.find((d) => d.id === metaDisciplinaId)?.servicos[0]?.unidade ?? 0,
                      valor_alvo: metaValorAlvo,
                      peso_percentual: metaPeso || undefined,
                    },
                    { onSuccess: () => { setMetaValorAlvo(''); setMetaPeso('') } },
                  )
                }
              >
                Adicionar meta
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Equipes">
        <div aria-label="Equipes">
          {equipes.length === 0 && <p className="text-muted">Nenhuma equipe cadastrada ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {equipes.map((equipe) => (
              <li className="list-group-item" key={equipe.id}>
                <strong>{equipe.nome}</strong>
                <ul className="mb-0">
                  {equipe.pessoas.map((pessoa) => (
                    <li key={pessoa.id}>
                      {pessoa.nome} — {pessoa.funcao}
                    </li>
                  ))}
                  {equipe.maquinas.map((maquina) => (
                    <li key={maquina.id}>
                      {maquina.nome} ({maquina.codigo})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="row g-2 align-items-end mb-4">
            <div className="col-auto">
              <label htmlFor="nova-equipe" className="form-label">
                Nova equipe
              </label>
              <input id="nova-equipe" className="form-control" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
            </div>
            <div className="col-auto">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!nomeEquipe.trim() || criarEquipe.isPending}
                onClick={() => criarEquipe.mutate(nomeEquipe, { onSuccess: () => setNomeEquipe('') })}
              >
                Adicionar equipe
              </button>
            </div>
          </div>

          <h5>Adicionar pessoa</h5>
          <div className="row g-2 align-items-end mb-4">
            <div className="col-md-3">
              <label htmlFor="pessoa-equipe" className="form-label">
                Equipe
              </label>
              <select id="pessoa-equipe" className="form-select" value={pessoaEquipeId} onChange={(event) => setPessoaEquipeId(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="pessoa-nome" className="form-label">
                Nome
              </label>
              <input id="pessoa-nome" className="form-control" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="pessoa-funcao" className="form-label">
                Função
              </label>
              <input id="pessoa-funcao" className="form-control" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!pessoaEquipeId || !pessoaNome.trim() || criarPessoa.isPending}
                onClick={() =>
                  criarPessoa.mutate(
                    { equipeId: pessoaEquipeId, nome: pessoaNome, funcao: pessoaFuncao },
                    { onSuccess: () => { setPessoaNome(''); setPessoaFuncao('') } },
                  )
                }
              >
                Adicionar pessoa
              </button>
            </div>
          </div>

          <h5>Adicionar máquina</h5>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label htmlFor="maquina-equipe" className="form-label">
                Equipe
              </label>
              <select id="maquina-equipe" className="form-select" value={maquinaEquipeId} onChange={(event) => setMaquinaEquipeId(event.target.value)}>
                <option value="">Selecione…</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="maquina-codigo" className="form-label">
                Código
              </label>
              <input id="maquina-codigo" className="form-control" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="maquina-nome" className="form-label">
                Nome
              </label>
              <input id="maquina-nome" className="form-control" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!maquinaEquipeId || !maquinaNome.trim() || criarMaquina.isPending}
                onClick={() =>
                  criarMaquina.mutate(
                    { equipeId: maquinaEquipeId, codigo: maquinaCodigo, nome: maquinaNome },
                    { onSuccess: () => { setMaquinaCodigo(''); setMaquinaNome('') } },
                  )
                }
              >
                Adicionar máquina
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Valores">
        <div aria-label="Valores de custo">
          {valoresCusto.length === 0 && <p className="text-muted">Nenhum valor cadastrado ainda.</p>}
          <ul className="list-group list-group-flush mb-3">
            {valoresCusto.map((valor) => (
              <li className="list-group-item" key={valor.id}>
                {valor.descricao} ({valor.tipo}): {valor.valor}
              </li>
            ))}
          </ul>
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label htmlFor="valor-tipo" className="form-label">
                Tipo
              </label>
              <select id="valor-tipo" className="form-select" value={valorTipo} onChange={(event) => setValorTipo(event.target.value as typeof valorTipo)}>
                <option value="mao_de_obra">Mão de obra</option>
                <option value="equipamento">Equipamento</option>
              </select>
            </div>
            <div className="col-md-3">
              <label htmlFor="valor-descricao" className="form-label">
                Descrição
              </label>
              <input id="valor-descricao" className="form-control" value={valorDescricao} onChange={(event) => setValorDescricao(event.target.value)} />
            </div>
            <div className="col-md-3">
              <label htmlFor="valor-valor" className="form-label">
                Valor
              </label>
              <input id="valor-valor" className="form-control" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
            </div>
            <div className="col-md-3">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                onClick={() =>
                  criarValorCusto.mutate(
                    { tipo: valorTipo, descricao: valorDescricao, valor: valorValor },
                    { onSuccess: () => { setValorDescricao(''); setValorValor('') } },
                  )
                }
              >
                Adicionar valor
              </button>
            </div>
          </div>
        </div>
      </Card>
    </main>
  )
}
