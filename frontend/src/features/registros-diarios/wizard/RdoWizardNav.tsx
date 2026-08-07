import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui'

export const NOMES_PASSOS = [
  'Gerais',
  'Produção',
  'Equipe',
  'Máquinas',
  'Ocorrências',
  'Fotos',
  'Revisão',
] as const

interface RdoWizardNavProps {
  passoAtual: number
  onAnterior: () => void
  onProximo: () => void
}

export function RdoWizardNav({ passoAtual, onAnterior, onProximo }: RdoWizardNavProps) {
  const ultimoPasso = passoAtual === NOMES_PASSOS.length - 1
  const progresso = Math.round(((passoAtual + 1) / NOMES_PASSOS.length) * 100)
  const proximoPasso = NOMES_PASSOS[passoAtual + 1]

  return (
    <nav aria-label="Passos do registro diário" className="mb-5 rounded-lg border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Passo {passoAtual + 1} de {NOMES_PASSOS.length} · {progresso}% completo
          </p>
          <h2 className="mt-1 font-display text-lg font-bold leading-6 text-ink">{NOMES_PASSOS[passoAtual]}</h2>
          {proximoPasso && <p className="mt-0.5 text-sm text-muted-foreground">Próximo passo: {proximoPasso}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
          {passoAtual > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onAnterior}>
              <ChevronLeft size={15} aria-hidden="true" />
              Anterior
            </Button>
          ) : (
            <span />
          )}
          {!ultimoPasso && (
            <Button type="button" size="sm" onClick={onProximo}>
              Próximo
              <ChevronRight size={15} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso do registro diário"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progresso}
        className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
      </div>

      <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
        <ol className="grid min-w-[44rem] grid-cols-7 items-start" aria-label="Etapas do registro diário">
          {NOMES_PASSOS.map((nome, index) => {
            const concluido = index < passoAtual
            const atual = index === passoAtual
            return (
              <li key={nome} className="relative flex flex-col items-center text-center">
                {index > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-3 h-0.5 w-1/2 ${index <= passoAtual ? 'bg-emerald-500' : 'bg-border'}`}
                  />
                )}
                {index < NOMES_PASSOS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-0 top-3 h-0.5 w-1/2 ${concluido ? 'bg-emerald-500' : 'bg-border'}`}
                  />
                )}
                <span
                  aria-current={atual ? 'step' : undefined}
                  className={`relative z-10 flex size-6 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    concluido
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : atual
                        ? 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15'
                        : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  {concluido ? <Check size={13} aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={`mt-2 max-w-24 truncate text-xs font-semibold ${
                    atual ? 'text-primary' : concluido ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                  }`}
                >
                  {nome}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
