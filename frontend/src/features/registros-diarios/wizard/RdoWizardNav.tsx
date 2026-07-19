import { Button } from '../../../components/ui'

export const NOMES_PASSOS = ['Gerais', 'Produção', 'Equipe', 'Máquinas', 'Ocorrências', 'Revisão'] as const

interface RdoWizardNavProps {
  passoAtual: number
  onAnterior: () => void
  onProximo: () => void
}

export function RdoWizardNav({ passoAtual, onAnterior, onProximo }: RdoWizardNavProps) {
  const ultimoPasso = passoAtual === NOMES_PASSOS.length - 1

  return (
    <div className="mb-6">
      <ol
        className="mb-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground"
        aria-label="Passos do registro diário"
      >
        {NOMES_PASSOS.map((nome, index) => (
          <li
            key={nome}
            className={index === passoAtual ? 'font-semibold text-ink' : undefined}
            aria-current={index === passoAtual ? 'step' : undefined}
          >
            {index + 1}. {nome}
          </li>
        ))}
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
