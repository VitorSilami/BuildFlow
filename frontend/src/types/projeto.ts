export type ProjetoStatus = 'ativo' | 'pausado' | 'concluido'

export interface Projeto {
  id: string
  nome: string
  descricao: string
  numero_contrato: string
  trecho: string
  engenheiro_responsavel: string
  status: ProjetoStatus
  execucao_percentual: string | null
  ultimo_rdo_data: string | null
  criado_por: number
  created_at: string
  updated_at: string
}

export interface ProjetoListResponse {
  count: number
  next: string | null
  previous: string | null
  results: Projeto[]
}
