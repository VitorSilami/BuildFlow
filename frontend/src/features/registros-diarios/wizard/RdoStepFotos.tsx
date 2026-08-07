import { useEffect, useRef, useState } from 'react'
import { ImagePlus, MapPin, Trash2, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Alert, Button, Input, PhotoUploadButton } from '../../../components/ui'
import { RdoEmptyState, RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'

export interface FotoStaged {
  arquivo: File
  preview: string
  km: string
}

interface RdoStepFotosProps {
  fotos: FotoStaged[]
  onFotosChange: Dispatch<SetStateAction<FotoStaged[]>>
}

function formatarTamanho(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export function RdoStepFotos({ fotos, onFotosChange }: RdoStepFotosProps) {
  const fotosRef = useRef(fotos)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const fotosComKm = fotos.filter((foto) => foto.km.trim()).length

  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])

  useEffect(() => {
    return () => {
      fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.preview))
    }
  }, [])

  function adicionarArquivos(arquivos: FileList | null) {
    if (!arquivos) return
    const selecionados = Array.from(arquivos)
    const imagens = selecionados.filter((arquivo) => arquivo.type.startsWith('image/'))
    const ignorados = selecionados.length - imagens.length

    setErroArquivo(ignorados > 0 ? `${ignorados} arquivo(s) ignorado(s). Selecione apenas imagens.` : null)

    const novas = imagens.map((arquivo) => ({
      arquivo,
      preview: URL.createObjectURL(arquivo),
      km: '',
    }))
    onFotosChange((current) => [...current, ...novas])
  }

  function removerFoto(index: number) {
    onFotosChange((current) => {
      const removida = current[index]
      if (removida) URL.revokeObjectURL(removida.preview)
      return current.filter((_, i) => i !== index)
    })
  }

  function removerTodas() {
    onFotosChange((current) => {
      current.forEach((foto) => URL.revokeObjectURL(foto.preview))
      return []
    })
    setErroArquivo(null)
  }

  function atualizarKm(index: number, km: string) {
    onFotosChange((current) => current.map((item, i) => (i === index ? { ...item, km } : item)))
  }

  return (
    <RdoStepShell
      label="Fotos"
      title="Anexe evidências fotográficas"
      description="Use câmera ou galeria, revise as imagens antes de salvar e informe o km quando a foto estiver ligada a um trecho específico."
      metrics={
        <>
          <RdoMetric label="Fotos" value={fotos.length} tone={fotos.length ? 'success' : 'neutral'} />
          <RdoMetric label="Com km" value={fotosComKm} tone={fotosComKm ? 'success' : 'neutral'} />
          <RdoMetric label="Pendentes de km" value={fotos.length - fotosComKm} tone={fotos.length - fotosComKm ? 'warning' : 'success'} />
          <RdoMetric label="Envio" value="Ao salvar" />
        </>
      }
    >
      <RdoSection
        title="Evidências do RDO"
        description="Anexe fotos da câmera ou da galeria como evidência do dia. Informe o km quando a localização for relevante."
        icon={<ImagePlus size={17} aria-hidden="true" />}
        actions={
          fotos.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={removerTodas}>
              <Trash2 size={14} aria-hidden="true" />
              Remover todas
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PhotoUploadButton
            id="rdo-foto-camera"
            label="Câmera"
            description="Abrir câmera traseira"
            useCamera
            onFilesSelected={adicionarArquivos}
          />
          <PhotoUploadButton
            id="rdo-foto-galeria"
            label="Galeria"
            description="Selecionar uma ou mais imagens"
            multiple
            onFilesSelected={adicionarArquivos}
          />
        </div>
      </RdoSection>

      {erroArquivo && <Alert>{erroArquivo}</Alert>}

      {fotos.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-sm font-semibold text-ink">
              {fotos.length} foto{fotos.length > 1 ? 's' : ''} anexada{fotos.length > 1 ? 's' : ''}
            </p>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Essas fotos serão enviadas ao salvar o registro.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fotos.map((foto, index) => (
              <figure key={`${foto.arquivo.name}-${index}`} className="m-0 overflow-hidden rounded-lg border border-border bg-background">
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`Remover foto ${index + 1}`}
                    onClick={() => removerFoto(index)}
                    className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 text-ink shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                  <img src={foto.preview} alt={`Prévia da foto ${index + 1}`} className="aspect-video w-full object-cover" />
                </div>
                <figcaption className="space-y-3 border-t border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{foto.arquivo.name}</p>
                    <p className="text-xs text-muted-foreground">{formatarTamanho(foto.arquivo.size)}</p>
                  </div>
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MapPin size={12} aria-hidden="true" />
                      Km da foto {index + 1}
                    </span>
                    <Input
                      aria-label={`Km da foto ${index + 1}`}
                      value={foto.km}
                      placeholder="Ex.: 10.250"
                      onChange={(event) => atualizarKm(index, event.target.value)}
                    />
                  </label>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <RdoEmptyState
          title="Nenhuma foto selecionada ainda."
          description="Você pode seguir sem fotos e anexar evidências depois no detalhe do registro."
          icon={<ImagePlus size={18} aria-hidden="true" />}
        />
      )}
    </RdoStepShell>
  )
}
