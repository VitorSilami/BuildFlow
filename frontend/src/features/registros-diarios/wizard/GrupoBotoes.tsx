import { Button } from '../../../components/ui'

interface GrupoBotoesOption<T extends string> {
  value: T
  label: string
}

interface GrupoBotoesProps<T extends string> {
  id: string
  label: string
  value: T
  onChange: (value: T) => void
  options: GrupoBotoesOption<T>[]
}

export function GrupoBotoes<T extends string>({ id, label, value, onChange, options }: GrupoBotoesProps<T>) {
  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium text-ink">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={value === option.value ? 'default' : 'outline'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
