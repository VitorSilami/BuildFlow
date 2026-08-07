import { useEffect, useState } from 'react'
import { ImagePlus, MapPin, RotateCcw, Trash2, Upload } from 'lucide-react'
import { Alert, Button, FormField, Input, PhotoUploadButton } from '../../components/ui'
import { toast } from '../../hooks/use-toast'
import { useEnviarFoto } from './registrosDiariosApi'

interface FotoUploadProps {
  registroId: string
}

export function FotoUpload({ registroId }: FotoUploadProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [km, setKm] = useState('')
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const enviarFoto = useEnviarFoto(registroId)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function handleFileChange(files: FileList | null) {
    const file = files?.[0] ?? null
    setErroArquivo(null)
    if (preview) URL.revokeObjectURL(preview)
    if (file && !file.type.startsWith('image/')) {
      setArquivo(null)
      setPreview(null)
      setErroArquivo('Selecione um arquivo de imagem.')
      return
    }
    setArquivo(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function limparSelecao() {
    if (preview) URL.revokeObjectURL(preview)
    setArquivo(null)
    setPreview(null)
    setKm('')
    setErroArquivo(null)
  }

  function handleEnviar() {
    if (!arquivo) return
    enviarFoto.mutate(
      { arquivo, km: km || undefined },
      {
        onSuccess: () => {
          limparSelecao()
          toast({ title: 'Foto anexada', description: 'A evidência foi enviada para este RDO.', variant: 'success' })
        },
      },
    )
  }

  const tamanhoArquivo = arquivo
    ? (arquivo.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    : null

  return (
    <div aria-label="Anexar foto" className="rounded-lg border border-dashed border-border bg-surface/50 p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div>
          {preview ? (
            <figure className="m-0 overflow-hidden rounded-lg border border-border bg-background">
              <img src={preview} alt="Pré-visualização da foto selecionada" className="aspect-square w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <span className="truncate">{arquivo?.name}</span>
                {tamanhoArquivo && <span className="shrink-0">{tamanhoArquivo} MB</span>}
              </figcaption>
            </figure>
          ) : (
            <PhotoUploadButton
              id="foto-arquivo"
              label="Escolher foto"
              description="PNG ou JPG da obra"
              onFilesSelected={handleFileChange}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <ImagePlus size={16} aria-hidden="true" />
              Nova evidência fotográfica
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Anexe uma foto do trecho executado, ocorrência ou condição de campo. O km ajuda a localizar a evidência depois.
            </p>
          </div>

          {preview && (
            <div className="flex flex-wrap gap-2">
              <PhotoUploadButton
                id="foto-arquivo"
                label="Trocar foto"
                description="Selecionar outra imagem"
                onFilesSelected={handleFileChange}
                className="min-h-0 flex-1 py-3"
              />
              <Button type="button" variant="outline" onClick={limparSelecao}>
                <Trash2 size={16} aria-hidden="true" />
                Remover
              </Button>
            </div>
          )}

          <FormField id="foto-km" label="Km (opcional)">
            <div className="relative">
              <MapPin size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="foto-km"
                value={km}
                placeholder="Ex.: 10.250"
                className="pl-9"
                onChange={(event) => setKm(event.target.value)}
              />
            </div>
          </FormField>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
              {enviarFoto.isPending ? (
                <>
                  <RotateCcw size={16} aria-hidden="true" className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload size={16} aria-hidden="true" />
                  Anexar foto
                </>
              )}
            </Button>
            {arquivo && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Foto pronta para envio.
              </span>
            )}
          </div>

          {erroArquivo && <Alert>{erroArquivo}</Alert>}
          {enviarFoto.isError && <Alert>Não foi possível enviar a foto.</Alert>}
        </div>
      </div>
    </div>
  )
}
