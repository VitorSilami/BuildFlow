import type { StatusEap } from '../types/configuracao'

export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function formatData(iso: string | null): string {
  if (iso === null) return 'Nunca registrado'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

const LIMITE_EXECUCAO_BAIXA = 30
const LIMITE_EXECUCAO_MEDIA = 70

export function execucaoCorClasse(valor: string | null): string {
  if (valor === null) return 'bg-muted-foreground'
  const numero = Number(valor)
  if (numero < LIMITE_EXECUCAO_BAIXA) return 'bg-red-500'
  if (numero < LIMITE_EXECUCAO_MEDIA) return 'bg-amber-500'
  // A barra (componente Progress) trava visualmente em 100% de largura, mas o
  // rótulo numérico ao lado continua mostrando o valor real (ex.: 277%) — sem
  // uma cor própria pra "acima da meta", a barra cheia parece idêntica a uma
  // execução de exatos 100%, e os dois pareciam discordar.
  if (numero > 100) return 'bg-sky-500'
  return 'bg-emerald-500'
}

const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoeda(valor: string): string {
  return FORMATADOR_MOEDA.format(Number(valor))
}

export function formatDataHora(iso: string | null): string {
  if (iso === null) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_EAP_LABELS: Record<StatusEap, string> = {
  concluido: 'Concluído',
  no_prazo: 'No prazo',
  atencao: 'Atenção',
  critico: 'Crítico',
  nao_iniciado: 'Não iniciado',
  planejado: 'Planejado',
}

const STATUS_EAP_CORES: Record<StatusEap, string> = {
  concluido: 'bg-emerald-500',
  no_prazo: 'bg-emerald-500',
  atencao: 'bg-amber-500',
  critico: 'bg-red-500',
  nao_iniciado: 'bg-muted-foreground',
  planejado: 'bg-cyan-500',
}

export function statusEapLabel(status: StatusEap | null): string | null {
  return status === null ? null : STATUS_EAP_LABELS[status]
}

export function statusEapCorClasse(status: StatusEap | null): string {
  return status === null ? 'bg-muted-foreground' : STATUS_EAP_CORES[status]
}
