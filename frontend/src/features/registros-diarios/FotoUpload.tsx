import { useState, type ChangeEvent } from 'react'
import { Alert, FormField } from '../../components/ui'
import { useEnviarFoto } from './registrosDiariosApi'

interface FotoUploadProps {
  registroId: string
}

export function FotoUpload({ registroId }: FotoUploadProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [km, setKm] = useState('')
  const enviarFoto = useEnviarFoto(registroId)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
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
      <FormField id="foto-arquivo" label="Foto">
        <input id="foto-arquivo" type="file" accept="image/*" className="form-control" onChange={handleFileChange} />
      </FormField>

      {preview && <img src={preview} alt="Pré-visualização da foto" width={120} className="rounded mb-3" />}

      <FormField id="foto-km" label="Km (opcional)">
        <input id="foto-km" className="form-control" value={km} onChange={(event) => setKm(event.target.value)} />
      </FormField>

      <button type="button" className="btn btn-primary" onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
        {enviarFoto.isPending ? 'Enviando…' : 'Anexar foto'}
      </button>

      {enviarFoto.isError && <Alert>Não foi possível enviar a foto.</Alert>}
    </div>
  )
}
