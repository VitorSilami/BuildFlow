import { useRef, useState, type ChangeEvent } from 'react'
import { Alert, Button } from '../../components/ui'
import { toast } from '../../hooks/use-toast'
import { ImportarEapError, useImportarEap } from './configuracaoApi'

interface ImportarEapButtonProps {
  projetoId: string
}

export function ImportarEapButton({ projetoId }: ImportarEapButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [erros, setErros] = useState<string[] | null>(null)
  const importarEap = useImportarEap(projetoId)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!arquivo) return

    setErros(null)
    importarEap.mutate(arquivo, {
      onSuccess: (resultado) => {
        toast({
          title: `${resultado.disciplinas_criadas} disciplinas e ${resultado.servicos_criados} serviços importados.`,
          variant: 'success',
        })
      },
      onError: (error) => {
        if (error instanceof ImportarEapError) {
          setErros(error.erros ?? [error.detail ?? 'Não foi possível importar a planilha.'])
        } else {
          setErros(['Não foi possível importar a planilha.'])
        }
      },
    })
  }

  return (
    <div aria-label="Importar planilha da EAP">
      <Button
        type="button"
        variant="outline"
        disabled={importarEap.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {importarEap.isPending ? 'Importando…' : 'Importar planilha'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        aria-label="Importar planilha"
        className="hidden"
        onChange={handleFileChange}
      />
      {erros && (
        <Alert>
          <ul className="list-disc pl-4">
            {erros.map((erro) => (
              <li key={erro}>{erro}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  )
}
