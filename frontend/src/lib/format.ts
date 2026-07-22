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
