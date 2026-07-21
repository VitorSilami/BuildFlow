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
