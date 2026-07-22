import type { ProjetoStatus } from '../../types/projeto'

export const STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  concluido: 'Concluído',
}

// hover:bg-*/15 (identico ao estado normal) neutraliza o hover:bg-primary/80 do
// variant "default" do Badge — sem isso, passar o mouse faria o badge colorido
// piscar de volta para a cor primaria no hover, ja que tailwind-merge so agrupa
// conflitos entre classes com o mesmo prefixo de variante (hover: vs sem hover:
// nao sao o mesmo grupo, entao a classe do variant nao seria sobrescrita).
export const STATUS_BADGE_CLASS: Record<ProjetoStatus, string> = {
  ativo:
    'border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  pausado:
    'border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20',
  concluido:
    'border-transparent bg-slate-500/15 text-slate-700 hover:bg-slate-500/15 dark:bg-slate-500/20 dark:text-slate-400 dark:hover:bg-slate-500/20',
}
