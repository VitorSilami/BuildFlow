import type { Equipe } from './registroDiario'

export interface ProducaoVinculada {
  data_referencia: string
  quantidade: string
}

export interface PontoCartaControle {
  data_referencia: string
  quantidade: string
  fora_de_controle: boolean
}

export interface CartaControle {
  media: string
  desvio_padrao: string
  lsc: string
  lic: string
  pontos: PontoCartaControle[]
}

export type StatusEap = 'concluido' | 'no_prazo' | 'atencao' | 'critico' | 'nao_iniciado' | 'planejado'

export interface CatalogoServico {
  id: string
  nome: string
  unidade: number
  peso_percentual: string | null
  quantidade_planejada: string | null
  quantidade_executada: string
  quantidade_executada_manual: string
  producoes_vinculadas: ProducaoVinculada[]
  carta_controle: CartaControle | null
  avanco_percentual: string | null
  data_inicio_prevista: string | null
  data_fim_prevista: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
}

export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  pai: string | null
  servicos: CatalogoServico[]
  subdisciplinas: Disciplina[]
  avanco_percentual: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
  data_inicio_prevista: string | null
  data_fim_prevista: string | null
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
