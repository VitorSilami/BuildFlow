import { useState, type FormEvent } from 'react'
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
      <div>
        <label htmlFor="projeto-nome">Nome do projeto</label>
        <input
          id="projeto-nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
        {nomeError && (
          <p id="projeto-nome-erro" role="alert">
            {nomeError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="projeto-descricao">Breve descrição</label>
        <textarea
          id="projeto-descricao"
          value={descricao}
          onChange={(event) => setDescricao(event.target.value)}
        />
      </div>

      {criarProjeto.isError && <p role="alert">Não foi possível criar o projeto. Tente novamente.</p>}

      <button type="submit" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </button>
    </form>
  )
}
