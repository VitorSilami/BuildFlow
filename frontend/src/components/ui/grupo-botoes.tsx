import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface GrupoBotoesOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  // Classe aplicada só quando esta opção está selecionada (ex.: severidade da
  // RNC — Alta/Média/Baixa precisam de cor própria por opção, diferente do
  // preenchimento neutro padrão usado no RDO).
  colorClass?: string
}

interface GrupoBotoesProps<T extends string> {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: GrupoBotoesOption<T>[]
  disabled?: boolean
}

export function GrupoBotoes<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}: GrupoBotoesProps<T>) {
  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-ink">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selecionada = value === option.value
          return (
            <Button
              key={option.value}
              type="button"
              disabled={disabled}
              variant={selecionada && !option.colorClass ? 'default' : 'outline'}
              className={cn('gap-2', selecionada && option.colorClass)}
              onClick={() => onChange(option.value)}
            >
              {option.icon}
              {option.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
