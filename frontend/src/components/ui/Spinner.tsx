interface SpinnerProps {
  label: string
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="d-flex align-items-center gap-2 py-4" role="status">
      <div className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
