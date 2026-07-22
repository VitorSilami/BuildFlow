import type { Equipe } from './registroDiario'

export interface Disciplina {
  id: string
  nome: string
  servicos: { id: string; nome: string; unidade: number }[]
}

export interface MetaMensal {
  id: string
  disciplina: string
  unidade: number
  valor_alvo: string
  peso_percentual: string | null
}

export interface ValorCusto {
  id: string
  tipo: 'mao_de_obra' | 'equipamento'
  descricao: string
  valor: string
  funcao: string
  maquina: string | null
}

export interface ConfiguracaoProjeto {
  disciplinas: Disciplina[]
  equipes: Equipe[]
  metas: MetaMensal[]
  valores_custo: ValorCusto[]
  soma_pesos_metas: number
}
