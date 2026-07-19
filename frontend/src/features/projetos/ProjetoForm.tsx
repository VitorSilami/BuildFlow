import { useState, type FormEvent } from 'react'
import { Alert, Button, FormField, Input, SelectField, Textarea } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import type { ProjetoStatus } from '../../types/projeto'
import { useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  onCreated: () => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
]

export function ProjetoForm({ onCreated }: ProjetoFormProps) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [numeroContrato, setNumeroContrato] = useState('')
  const [trecho, setTrecho] = useState('')
  const [engenheiroResponsavel, setEngenheiroResponsavel] = useState('')
  const [status, setStatus] = useState<ProjetoStatus>('ativo')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNomeError(null)

    const result = projetoFormSchema.safeParse({
      nome,
      descricao,
      numero_contrato: numeroContrato,
      trecho,
      engenheiro_responsavel: engenheiroResponsavel,
      status,
    })
    if (!result.success) {
      setNomeError(result.error.issues[0]?.message ?? 'Dados inválidos.')
      return
    }

    criarProjeto.mutate(result.data, {
      onSuccess: () => {
        setNome('')
        setDescricao('')
        setNumeroContrato('')
        setTrecho('')
        setEngenheiroResponsavel('')
        setStatus('ativo')
        onCreated()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Criar novo projeto">
      <FormField id="projeto-nome" label="Nome do projeto" error={nomeError}>
        <Input
          id="projeto-nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          aria-invalid={nomeError ? 'true' : undefined}
          aria-describedby={nomeError ? 'projeto-nome-erro' : undefined}
        />
      </FormField>

      <FormField id="projeto-descricao" label="Breve descrição">
        <Textarea id="projeto-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </FormField>

      <FormField id="projeto-numero-contrato" label="Número do contrato">
        <Input
          id="projeto-numero-contrato"
          value={numeroContrato}
          onChange={(event) => setNumeroContrato(event.target.value)}
        />
      </FormField>

      <FormField id="projeto-trecho" label="Trecho">
        <Input id="projeto-trecho" value={trecho} onChange={(event) => setTrecho(event.target.value)} />
      </FormField>

      <FormField id="projeto-engenheiro-responsavel" label="Engenheiro responsável">
        <Input
          id="projeto-engenheiro-responsavel"
          value={engenheiroResponsavel}
          onChange={(event) => setEngenheiroResponsavel(event.target.value)}
        />
      </FormField>

      <SelectField
        id="projeto-status"
        label="Status"
        value={status}
        onChange={(value) => setStatus(value as ProjetoStatus)}
        options={STATUS_OPTIONS}
      />

      {criarProjeto.isError && <Alert>Não foi possível criar o projeto. Tente novamente.</Alert>}

      <Button type="submit" disabled={criarProjeto.isPending}>
        {criarProjeto.isPending ? 'Criando…' : 'Criar projeto'}
      </Button>
    </form>
  )
}
