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

  if (configuracao.isLoading) return <p role="status">Carregando…</p>
  if (configuracao.isError || !configuracao.data) {
    return (
      <div role="alert">
        <p>Não foi possível carregar a configuração do projeto.</p>
        <button type="button" onClick={() => void configuracao.refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const { disciplinas, equipes, metas, valores_custo: valoresCusto, soma_pesos_metas: somaPesos } =
    configuracao.data

  return (
    <main aria-label="Configurações do projeto">
      <h1>Configurações</h1>

      <section aria-label="Disciplinas">
        <h2>Disciplinas</h2>
        {disciplinas.length === 0 && <p>Nenhuma disciplina cadastrada ainda.</p>}
        <ul>
          {disciplinas.map((disciplina) => (
            <li key={disciplina.id}>{disciplina.nome}</li>
          ))}
        </ul>
        <label htmlFor="nova-disciplina">Nova disciplina</label>
        <input
          id="nova-disciplina"
          value={nomeDisciplina}
          onChange={(event) => setNomeDisciplina(event.target.value)}
        />
        <button
          type="button"
          onClick={() => criarDisciplina.mutate(nomeDisciplina, { onSuccess: () => setNomeDisciplina('') })}
          disabled={!nomeDisciplina.trim() || criarDisciplina.isPending}
        >
          Adicionar disciplina
        </button>
      </section>

      <section aria-label="Metas">
        <h2>Metas</h2>
        {metas.length === 0 && <p>Nenhuma meta cadastrada ainda.</p>}
        <ul>
          {metas.map((meta) => (
            <li key={meta.id}>
              {disciplinas.find((d) => d.id === meta.disciplina)?.nome ?? meta.disciplina}: {meta.valor_alvo}
              {meta.peso_percentual ? ` (${meta.peso_percentual}%)` : ''}
            </li>
          ))}
        </ul>
        <p>Soma dos pesos: {somaPesos}% {Math.abs(somaPesos - 100) > 0.01 && somaPesos > 0 && '(atenção: não fecha 100%)'}</p>

        <label htmlFor="meta-disciplina">Disciplina</label>
        <select
          id="meta-disciplina"
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
        <label htmlFor="meta-valor">Valor alvo</label>
        <input id="meta-valor" value={metaValorAlvo} onChange={(event) => setMetaValorAlvo(event.target.value)} />
        <label htmlFor="meta-peso">Peso (%)</label>
        <input id="meta-peso" value={metaPeso} onChange={(event) => setMetaPeso(event.target.value)} />
        <button
          type="button"
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
      </section>

      <section aria-label="Equipes">
        <h2>Equipes</h2>
        {equipes.length === 0 && <p>Nenhuma equipe cadastrada ainda.</p>}
        <ul>
          {equipes.map((equipe) => (
            <li key={equipe.id}>
              <strong>{equipe.nome}</strong>
              <ul>
                {equipe.pessoas.map((pessoa) => (
                  <li key={pessoa.id}>{pessoa.nome} — {pessoa.funcao}</li>
                ))}
                {equipe.maquinas.map((maquina) => (
                  <li key={maquina.id}>{maquina.nome} ({maquina.codigo})</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <label htmlFor="nova-equipe">Nova equipe</label>
        <input id="nova-equipe" value={nomeEquipe} onChange={(event) => setNomeEquipe(event.target.value)} />
        <button
          type="button"
          disabled={!nomeEquipe.trim() || criarEquipe.isPending}
          onClick={() => criarEquipe.mutate(nomeEquipe, { onSuccess: () => setNomeEquipe('') })}
        >
          Adicionar equipe
        </button>

        <h3>Adicionar pessoa</h3>
        <label htmlFor="pessoa-equipe">Equipe</label>
        <select id="pessoa-equipe" value={pessoaEquipeId} onChange={(event) => setPessoaEquipeId(event.target.value)}>
          <option value="">Selecione…</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>
        <label htmlFor="pessoa-nome">Nome</label>
        <input id="pessoa-nome" value={pessoaNome} onChange={(event) => setPessoaNome(event.target.value)} />
        <label htmlFor="pessoa-funcao">Função</label>
        <input id="pessoa-funcao" value={pessoaFuncao} onChange={(event) => setPessoaFuncao(event.target.value)} />
        <button
          type="button"
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

        <h3>Adicionar máquina</h3>
        <label htmlFor="maquina-equipe">Equipe</label>
        <select id="maquina-equipe" value={maquinaEquipeId} onChange={(event) => setMaquinaEquipeId(event.target.value)}>
          <option value="">Selecione…</option>
          {equipes.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}
            </option>
          ))}
        </select>
        <label htmlFor="maquina-codigo">Código</label>
        <input id="maquina-codigo" value={maquinaCodigo} onChange={(event) => setMaquinaCodigo(event.target.value)} />
        <label htmlFor="maquina-nome">Nome</label>
        <input id="maquina-nome" value={maquinaNome} onChange={(event) => setMaquinaNome(event.target.value)} />
        <button
          type="button"
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
      </section>

      <section aria-label="Valores de custo">
        <h2>Valores</h2>
        {valoresCusto.length === 0 && <p>Nenhum valor cadastrado ainda.</p>}
        <ul>
          {valoresCusto.map((valor) => (
            <li key={valor.id}>
              {valor.descricao} ({valor.tipo}): {valor.valor}
            </li>
          ))}
        </ul>
        <label htmlFor="valor-tipo">Tipo</label>
        <select id="valor-tipo" value={valorTipo} onChange={(event) => setValorTipo(event.target.value as typeof valorTipo)}>
          <option value="mao_de_obra">Mão de obra</option>
          <option value="equipamento">Equipamento</option>
        </select>
        <label htmlFor="valor-descricao">Descrição</label>
        <input id="valor-descricao" value={valorDescricao} onChange={(event) => setValorDescricao(event.target.value)} />
        <label htmlFor="valor-valor">Valor</label>
        <input id="valor-valor" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
        <button
          type="button"
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
      </section>
    </main>
  )
}
