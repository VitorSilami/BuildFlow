import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import type { BadgeTone } from '../../components/ui/app-status-badge'
import type { StatusEfetivo } from '../../types/rnc'

export const STATUS_EFETIVO_LABEL: Record<StatusEfetivo, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  prazo_excedido: 'Prazo excedido',
}

export const STATUS_EFETIVO_TONE: Record<StatusEfetivo, BadgeTone> = {
  pendente: 'warning',
  concluida: 'success',
  prazo_excedido: 'danger',
}

export const STATUS_EFETIVO_ICON: Record<StatusEfetivo, typeof Clock> = {
  pendente: Clock,
  concluida: CheckCircle2,
  prazo_excedido: AlertTriangle,
}
