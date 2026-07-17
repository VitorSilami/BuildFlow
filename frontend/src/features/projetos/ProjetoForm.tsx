import { useState, type FormEvent } from 'react'
import { Alert, FormField } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import { useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  onCreated: () => void
}

export function ProjetoForm({ onCreated }: ProjetoFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNomeError(null)

    const result = projetoFormSchema.safeParse({ nome, descricao })
    if (!result.success) {
      setNomeError(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarProjeto.mutate(result.data, {
      onSuccess: () => {
        setNome('')
        setDescricao('')
        onCreated()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Criar novo projeto">
      <FormField id="projeto-nome" label="Nome do projeto" error={nomeError}>
        <input
          id="projeto-nome"
          className="form-control"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
      </FormField>

      <FormField id="projeto-descricao" label="Breve descrição">
        <textarea
          id="projeto-descricao"
          className="form-control"
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
        />
      </FormField>

      {criarProjeto.isError && <Alert>Não foi possível criar o projeto. Tente novamente.</Alert>}

      <button type="submit" className="btn btn-primary" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </button>
    </form>
  )
}
