export type Categoria =
  | 'terraplenagem'
  | 'pavimentacao'
  | 'contencoes'
  | 'oaes'
  | 'oacs_e_drenagem'
  | 'sinalizacao_seguranca'
  | 'outros'

export type Origem = 'produto' | 'servico' | 'pessoal' | 'seguranca' | 'equipamento' | 'projeto'
export type Gravidade = 'alta' | 'media' | 'baixa'
export type TipoRnc = 'ac' | 'ap'
export type StatusRnc = 'pendente' | 'concluida'
export type StatusEfetivo = StatusRnc | 'prazo_excedido'
export type Eficacia = '' | 'eficaz' | 'ineficaz'

export interface AcaoCorretivaInput {
  descricao: string
  risco: string
  data_limite: string
  responsavel: string
}

export interface AcaoCorretiva extends AcaoCorretivaInput {
  id: string
}

export interface RncInput {
  data_emissao: string
  contratada: string
  categoria: Categoria
  origem: Origem
  gravidade: Gravidade
  tipo: TipoRnc
  item: string
  subitem: string
  norma: string
  requisito: string
  abrangencia: string
  km: string
  reincidencia: boolean
  descricao: string
  acao_imediata: string
  data_implementacao: string | null
  responsavel_implementacao: string
  causa_metodo: boolean
  causa_metodo_detalhe: string
  causa_material: boolean
  causa_material_detalhe: string
  causa_mao_de_obra: boolean
  causa_mao_de_obra_detalhe: string
  causa_maquina: boolean
  causa_maquina_detalhe: string
  causa_medicao: boolean
  causa_medicao_detalhe: string
  causa_meio_ambiente: boolean
  causa_meio_ambiente_detalhe: string
  data_prazo: string | null
  acoes_corretivas: AcaoCorretivaInput[]
}

export interface Rnc extends RncInput {
  id: string
  projeto: string
  numero_sequencial: number
  status: StatusRnc
  status_efetivo: StatusEfetivo
  eficacia: Eficacia
  data_conclusao: string | null
  criado_por: number
  created_at: string
  updated_at: string
  acoes_corretivas: AcaoCorretiva[]
}
