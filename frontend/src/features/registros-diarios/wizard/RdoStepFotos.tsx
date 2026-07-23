import { Camera, Image as ImageIcon, MapPin, X } from 'lucide-react'
import { useRef, type Dispatch, type SetStateAction } from 'react'
import { Input } from '../../../components/ui'

export interface FotoStaged {
  arquivo: File
  preview: string
  km: string
}

interface RdoStepFotosProps {
  fotos: FotoStaged[]
  onFotosChange: Dispatch<SetStateAction<FotoStaged[]>>
}

export function RdoStepFotos({ fotos, onFotosChange }: RdoStepFotosProps) {
  const inputCameraRef = useRef<HTMLInputElement>(null)
  const inputGaleriaRef = useRef<HTMLInputElement>(null)

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return
    const novas = Array.from(arquivos).map((arquivo) => ({
      arquivo,
      preview: URL.createObjectURL(arquivo),
      km: '',
    }))
    onFotosChange((current) => [...current, ...novas])
  }

  function removerFoto(index: number) {
    onFotosChange((current) => current.filter((_, i) => i !== index))
  }

  function atualizarKm(index: number, km: string) {
    onFotosChange((current) => current.map((item, i) => (i === index ? { ...item, km } : item)))
  }

  return (
    <div aria-label="Fotos">
      <p className="mb-4 text-sm text-muted-foreground">
        Anexe fotos da câmera ou da galeria como evidência do dia. Informe o km, se relevante.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => inputCameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Camera size={20} aria-hidden="true" />
          Câmera
        </button>
        <button
          type="button"
          onClick={() => inputGaleriaRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ImageIcon size={20} aria-hidden="true" />
          Galeria
        </button>
        <input
          ref={inputCameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Tirar foto com a câmera"
          onChange={(event) => {
            adicionarArquivos(event.target.files)
            event.target.value = ''
          }}
        />
        <input
          ref={inputGaleriaRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Escolher fotos da galeria"
          onChange={(event) => {
            adicionarArquivos(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {fotos.length > 0 && (
        <>
          <div className="mb-2 grid grid-cols-2 gap-3 md:grid-cols-3">
            {fotos.map((foto, index) => (
              <div key={index} className="relative overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  aria-label={`Remover foto ${index + 1}`}
                  onClick={() => removerFoto(index)}
                  className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 text-ink shadow-sm"
                >
                  <X size={12} aria-hidden="true" />
                </button>
                <img src={foto.preview} alt={`Foto ${index + 1}`} className="h-28 w-full object-cover" />
                <div className="flex items-center gap-1 border-t border-border bg-surface px-2 py-1">
                  <MapPin size={12} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <Input
                    aria-label={`Km da foto ${index + 1}`}
                    value={foto.km}
                    placeholder="Km"
                    className="h-6 border-none px-1 text-xs shadow-none"
                    onChange={(event) => atualizarKm(index, event.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {fotos.length} foto{fotos.length > 1 ? 's' : ''} anexada{fotos.length > 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
