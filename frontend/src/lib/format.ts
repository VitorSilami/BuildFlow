export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}

export function formatData(iso: string | null): string {
  if (iso === null) return 'Nunca registrado'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}
