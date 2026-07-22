export interface MaoDeObraPorFuncao {
  funcao: string
  dias_trabalhados: number
  faltas: number
  atestados: number
  custo: string
  deficit: string
  tem_valor_cadastrado: boolean
}

export interface MaquinaPorEquipamento {
  maquina_id: string
  codigo: string
  nome: string
  equipe_nome: string
  horas_produtivas: string
  horas_paradas: string
  custo_produtivo: string
  custo_ocioso: string
  eficiencia_percentual: number | null
  tem_valor_cadastrado: boolean
}

export interface HorasOciosasPorCausa {
  motivo: string
  horas: string
}

export interface FaltaPorPessoa {
  pessoa_id: string
  nome: string
  funcao: string
  faltas: number
  atestados: number
  valor_perdido: string
  reincidente: boolean
}

export interface CustosOciosidade {
  mes: string
  custo_mao_de_obra: string
  deficit_mao_de_obra: string
  custo_produtivo_maquinas: string
  custo_ocioso_maquinas: string
  custo_total: string
  ociosidade_evitavel_total: string
  horas_ociosas_total: string
  eficiencia_gerencial_percentual: number | null
  mao_de_obra_por_funcao: MaoDeObraPorFuncao[]
  maquinas_por_equipamento: MaquinaPorEquipamento[]
  horas_ociosas_por_causa: HorasOciosasPorCausa[]
  faltas_por_pessoa: FaltaPorPessoa[]
}
