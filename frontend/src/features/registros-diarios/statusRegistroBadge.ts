import type { StatusRegistro } from '../../types/registroDiario'

export const STATUS_REGISTRO_LABEL: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

export const STATUS_REGISTRO_COR_TEXTO: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'border-amber-500 text-amber-600',
  aprovado: 'border-emerald-500 text-emerald-600',
  rejeitado: 'border-red-500 text-red-600',
}

export const STATUS_REGISTRO_COR_CELULA: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'border-amber-500/50 bg-amber-500/10',
  aprovado: 'border-emerald-500/50 bg-emerald-500/10',
  rejeitado: 'border-red-500/50 bg-red-500/10',
}

// Quando um dia tem RDOs em mais de um status, o que exige mais atencao vence
// visualmente no calendario (rejeitado > aguardando > aprovado).
export const PRIORIDADE_STATUS_REGISTRO: StatusRegistro[] = [
  'rejeitado',
  'aguardando_aprovacao',
  'aprovado',
]
