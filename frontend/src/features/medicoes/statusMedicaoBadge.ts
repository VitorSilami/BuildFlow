import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { BadgeTone } from '../../components/ui/app-status-badge'
import type { StatusMedicao } from '../../types/medicao'

export const STATUS_MEDICAO_LABEL: Record<StatusMedicao, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

export const STATUS_MEDICAO_TONE: Record<StatusMedicao, BadgeTone> = {
  aguardando_aprovacao: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
}

export const STATUS_MEDICAO_ICON: Record<StatusMedicao, typeof Clock> = {
  aguardando_aprovacao: Clock,
  aprovado: CheckCircle2,
  rejeitado: XCircle,
}
