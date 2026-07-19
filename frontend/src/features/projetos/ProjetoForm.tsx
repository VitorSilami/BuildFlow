import { useState, type FormEvent } from 'react'
import { Alert, Button, FormField, Input, SelectField, Textarea } from '../../components/ui'
import { projetoFormSchema } from '../../schemas/projeto'
import type { Projeto, ProjetoStatus } from '../../types/projeto'
import { useAtualizarProjeto, useCriarProjeto } from './projetosApi'

interface ProjetoFormProps {
  projeto?: Projeto
  onSuccess: () => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'concluido', label: 'Concluído' },
]

export function ProjetoForm({ projeto, onSuccess }: ProjetoFormProps) {
  const [nome, setNome] = useState(projeto?.nome ?? '')
  const [descricao, setDescricao] = useState(projeto?.descricao ?? '')
  const [numeroContrato, setNumeroContrato] = useState(projeto?.numero_contrato ?? '')
  const [trecho, setTrecho] = useState(projeto?.trecho ?? '')
  const [engenheiroResponsavel, setEngenheiroResponsavel] = useState(
    projeto?.engenheiro_responsavel ?? '',
  )
  const [status, setStatus] = useState<ProjetoStatus>(projeto?.status ?? 'ativo')
  const [nomeError, setNomeError] = useState<string | null>(null)
  const criarProjeto = useCriarProjeto()
  const atualizarProjeto = useAtualizarProjeto(projeto?.id ?? '')
  const mutation = projeto ? atualizarProjeto : criarProjeto

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

    mutation.mutate(result.data, {
      onSuccess: () => {
        if (!projeto) {
          setNome('')
          setDescricao('')
          setNumeroContrato('')
          setTrecho('')
          setEngenheiroResponsavel('')
          setStatus('ativo')
        }
        onSuccess()
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} aria-label={projeto ? 'Editar projeto' : 'Criar novo projeto'}>
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

      {mutation.isError && (
        <Alert>
          {projeto
            ? 'Não foi possível salvar as alterações. Tente novamente.'
            : 'Não foi possível criar o projeto. Tente novamente.'}
        </Alert>
      )}

      <Button type="submit" disabled={mutation.isPending}>
        {projeto
          ? mutation.isPending
            ? 'Salvando…'
            : 'Salvar alterações'
          : mutation.isPending
            ? 'Criando…'
            : 'Criar projeto'}
      </Button>
    </form>
  )
}
