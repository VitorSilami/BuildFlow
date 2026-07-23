import type { Equipe } from './registroDiario'

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
  peso_percentual: string | null
  quantidade_planejada: string | null
  quantidade_executada: string
  avanco_percentual: string | null
}

export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  servicos: CatalogoServico[]
  avanco_percentual: string | null
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
  valores_custo: ValorCusto[]
  soma_pesos_disciplinas: number
}
