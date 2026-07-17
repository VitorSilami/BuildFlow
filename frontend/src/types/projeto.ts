export interface Projeto {
  id: string
  nome: string
  descricao: string
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
