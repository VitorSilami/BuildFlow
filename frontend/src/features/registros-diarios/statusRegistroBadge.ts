import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { BadgeTone } from '../../components/ui/app-status-badge'
import type { StatusRegistro } from '../../types/registroDiario'

export const STATUS_REGISTRO_LABEL: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

export const STATUS_REGISTRO_TONE: Record<StatusRegistro, BadgeTone> = {
  aguardando_aprovacao: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
}

// Ícone junto da cor (não só cor) — mais acessível e consistente com o padrão
// de referência pesquisado (shadcn-admin, Plane): status não depende só de
// cor pra ser lido, importante pra relatório impresso em P&B.
export const STATUS_REGISTRO_ICON: Record<StatusRegistro, typeof Clock> = {
  aguardando_aprovacao: Clock,
  aprovado: CheckCircle2,
  rejeitado: XCircle,
}

export const STATUS_REGISTRO_COR_CELULA: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'border-warning/50 bg-warning/10',
  aprovado: 'border-success/50 bg-success/10',
  rejeitado: 'border-danger/50 bg-danger/10',
}

// Quando um dia tem RDOs em mais de um status, o que exige mais atencao vence
// visualmente no calendario (rejeitado > aguardando > aprovado).
export const PRIORIDADE_STATUS_REGISTRO: StatusRegistro[] = [
  'rejeitado',
  'aguardando_aprovacao',
  'aprovado',
]
