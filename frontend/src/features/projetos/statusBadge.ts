import { CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react'
import type { BadgeTone } from '../../components/ui/app-status-badge'
import type { ProjetoStatus } from '../../types/projeto'

export const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

export const STATUS_TONE: Record<ProjetoStatus, BadgeTone> = {
  ativo: 'success',
  pausado: 'warning',
  concluido: 'neutral',
}

export const STATUS_ICON: Record<ProjetoStatus, typeof PlayCircle> = {
  ativo: PlayCircle,
  pausado: PauseCircle,
  concluido: CheckCircle2,
}

// Dot de status compacto (sem caixa/borda) para contextos densos, como o
// cabeçalho de projeto atual na sidebar — mesma paleta do STATUS_BADGE_CLASS,
// sem o peso visual de um badge com borda.
export const STATUS_DOT_CLASS: Record<ProjetoStatus, string> = {
  ativo: 'bg-emerald-500',
  pausado: 'bg-amber-500',
  concluido: 'bg-slate-400',
}

// Acento na borda esquerda do card de projeto — mesma paleta do badge, dando
// leitura de status mesmo antes de ler o texto (reforca a hierarquia visual
// do card sem precisar de um fundo colorido cheio).
export const STATUS_ACCENT_CLASS: Record<ProjetoStatus, string> = {
  ativo: 'border-l-4 border-l-emerald-500',
  pausado: 'border-l-4 border-l-amber-500',
  concluido: 'border-l-4 border-l-slate-400',
}
