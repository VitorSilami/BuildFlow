import { Camera, Image as ImageIcon } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'

interface PhotoUploadButtonProps {
  id: string
  label: string
  onFilesSelected: (files: FileList | null) => void
  multiple?: boolean
  // Abre a câmera traseira direto em dispositivos móveis, em vez da galeria.
  useCamera?: boolean
}

// Botão custom + input nativo escondido — o `<input type="file">` puro não
// aceita estilo além do pseudo-elemento `::file-selector-button`, então o
// texto "Nenhum arquivo escolhido" sempre fica com a fonte/aparência padrão
// do sistema operacional, destoando do resto do design system.
export function PhotoUploadButton({ id, label, onFilesSelected, multiple, useCamera }: PhotoUploadButtonProps) {
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
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Icon size={20} aria-hidden="true" />
        {label}
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
