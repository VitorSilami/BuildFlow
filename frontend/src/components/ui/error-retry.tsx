import { Button } from './button'
import { Alert } from './app-alert'

interface ErrorRetryProps {
  message: string
  onRetry: () => void
}

export function ErrorRetry({ message, onRetry }: ErrorRetryProps) {
  return (
    <Alert>
      <p className="mb-2">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Alert>
  )
}
