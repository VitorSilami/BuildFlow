import { Check } from 'lucide-react'
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

  return (
    <div className="mb-6">
      <ol className="mb-4 flex items-center" aria-label="Passos do registro diário">
        {NOMES_PASSOS.map((nome, index) => {
          const concluido = index < passoAtual
          const atual = index === passoAtual
          return (
            <li key={nome} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={atual ? 'step' : undefined}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    concluido
                      ? 'bg-emerald-500 text-white'
                      : atual
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                        : 'border-2 border-dashed border-border text-muted-foreground'
                  }`}
                >
                  {concluido ? <Check size={16} aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] font-medium uppercase tracking-wide ${
                    atual ? 'text-ink' : 'text-muted-foreground'
                  }`}
                >
                  {nome}
                </span>
              </div>
              {index < NOMES_PASSOS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 rounded-full ${concluido ? 'bg-emerald-500' : 'bg-border'}`} />
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex items-center justify-between">
        {passoAtual > 0 ? (
          <Button type="button" variant="outline" onClick={onAnterior}>
            Anterior
          </Button>
        ) : (
          <span />
        )}
        {!ultimoPasso && (
          <Button type="button" onClick={onProximo}>
            Próximo
          </Button>
        )}
      </div>
    </div>
  )
}
