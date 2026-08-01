import { useState } from 'react'
import { Alert, Button, FormField, Input, PhotoUploadButton } from '../../components/ui'
import { useEnviarFoto } from './registrosDiariosApi'

interface FotoUploadProps {
  registroId: string
}

export function FotoUpload({ registroId }: FotoUploadProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [km, setKm] = useState('')
  const enviarFoto = useEnviarFoto(registroId)

  function handleFileChange(files: FileList | null) {
    const file = files?.[0] ?? null
    setArquivo(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function handleEnviar() {
    if (!arquivo) return
    enviarFoto.mutate(
      { arquivo, km: km || undefined },
      {
        onSuccess: () => {
          setArquivo(null)
          setPreview(null)
          setKm('')
        },
      },
    )
  }

  return (
    <div aria-label="Anexar foto">
      <PhotoUploadButton id="foto-arquivo" label="Escolher foto" onFilesSelected={handleFileChange} />

      {preview && <img src={preview} alt="Pré-visualização da foto" width={120} className="mb-3 mt-3 rounded-md" />}

      <FormField id="foto-km" label="Km (opcional)">
        <Input id="foto-km" value={km} onChange={(event) => setKm(event.target.value)} />
      </FormField>

      <Button onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
        {enviarFoto.isPending ? 'Enviando…' : 'Anexar foto'}
      </Button>

      {enviarFoto.isError && <Alert>Não foi possível enviar a foto.</Alert>}
    </div>
  )
}
