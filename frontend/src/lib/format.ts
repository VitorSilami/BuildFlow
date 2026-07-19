export function formatExecucao(valor: string | null): string {
  return valor === null ? '—' : `${valor}%`
}
