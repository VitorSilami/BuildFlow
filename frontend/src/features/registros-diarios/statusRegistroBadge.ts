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
