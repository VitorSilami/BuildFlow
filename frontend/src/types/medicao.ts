export type StatusMedicao = 'aguardando_aprovacao' | 'aprovado' | 'rejeitado'

export interface ItemMedicao {
  id: string
  servico: string
  servico_nome: string
  disciplina_nome: string
  quantidade_anterior: string
  quantidade_acumulada: string
  quantidade_periodo: string
  preco_unitario_snapshot: string | null
  valor_periodo: string | null
}

export interface Medicao {
  id: string
  data_corte: string
  fiscal: number
  fiscal_nome: string
  criado_por: number
  criado_por_nome: string
  status: StatusMedicao
  motivo_rejeicao: string
  aprovado_em: string | null
  created_at: string
  itens: ItemMedicao[]
  valor_total: string
  quantidade_itens_sem_preco: number
}

export interface CriarMedicaoInput {
  data_corte: string
  fiscal: number
}
