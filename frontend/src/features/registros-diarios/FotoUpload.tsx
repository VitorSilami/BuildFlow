import { useState, type ChangeEvent } from 'react'
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
      <label htmlFor="foto-arquivo">Foto</label>
      <input id="foto-arquivo" type="file" accept="image/*" onChange={handleFileChange} />

      {preview && <img src={preview} alt="Pré-visualização da foto" width={120} />}

      <label htmlFor="foto-km">Km (opcional)</label>
      <input id="foto-km" value={km} onChange={(event) => setKm(event.target.value)} />

      <button type="button" onClick={handleEnviar} disabled={!arquivo || enviarFoto.isPending}>
        {enviarFoto.isPending ? 'Enviando…' : 'Anexar foto'}
      </button>

      {enviarFoto.isError && <p role="alert">Não foi possível enviar a foto.</p>}
    </div>
  )
}
