import { Camera, Image as ImageIcon } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { cn } from '../../lib/utils'

interface PhotoUploadButtonProps {
  id: string
  label: string
  onFilesSelected: (files: FileList | null) => void
  multiple?: boolean
  useCamera?: boolean
  description?: string
  className?: string
}

export function PhotoUploadButton({
  id,
  label,
  onFilesSelected,
  multiple,
  useCamera,
  description,
  className,
}: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const Icon = useCamera ? Camera : ImageIcon

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(event.target.files)
    event.target.value = ''
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Icon size={20} aria-hidden="true" />
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple={multiple}
        capture={useCamera ? 'environment' : undefined}
        className="hidden"
        aria-label={label}
        onChange={handleChange}
      />
    </>
  )
}
