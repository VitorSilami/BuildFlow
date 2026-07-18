import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  label: string
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
