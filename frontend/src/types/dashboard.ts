export interface DashboardProjeto {
  id: string
  nome: string
  status: 'ativo' | 'pausado' | 'concluido'
  execucao_percentual: string | null
}

export interface DashboardAlerta {
  projeto_id: string
  projeto_nome: string
  dias_sem_rdo: number | null
}

export interface DashboardResponse {
  projetos_ativos: number
  projetos_pausados: number
  projetos_concluidos: number
  execucao_media: string | null
  projetos: DashboardProjeto[]
  alertas: DashboardAlerta[]
}
