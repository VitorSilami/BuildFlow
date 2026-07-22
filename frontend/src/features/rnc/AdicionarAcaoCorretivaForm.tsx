import { useState } from 'react'
import { Alert, Button, FormField, Input, Textarea } from '../../components/ui'
import { useCriarAcaoCorretiva } from './rncApi'

interface AdicionarAcaoCorretivaFormProps {
  rncId: string
}

export function AdicionarAcaoCorretivaForm({ rncId }: AdicionarAcaoCorretivaFormProps) {
  const [descricao, setDescricao] = useState('')
  const [risco, setRisco] = useState('')
  const [dataLimite, setDataLimite] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const criarAcao = useCriarAcaoCorretiva(rncId)

  function handleAdicionar() {
    if (!descricao.trim() || !dataLimite || !responsavel.trim()) return
    criarAcao.mutate(
      { descricao, risco, data_limite: dataLimite, responsavel },
      {
        onSuccess: () => {
          setDescricao('')
          setRisco('')
          setDataLimite('')
          setResponsavel('')
        },
      },
    )
  }

  return (
    <div aria-label="Adicionar ação corretiva" className="rounded-md border border-dashed border-border p-4">
      <FormField id="acao-descricao" label="Descrição">
        <Textarea id="acao-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </FormField>
      <FormField id="acao-risco" label="Risco (opcional)">
        <Textarea id="acao-risco" value={risco} onChange={(event) => setRisco(event.target.value)} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField id="acao-data-limite" label="Data limite">
          <Input
            id="acao-data-limite"
            type="date"
            value={dataLimite}
            onChange={(event) => setDataLimite(event.target.value)}
          />
        </FormField>
        <FormField id="acao-responsavel" label="Responsável">
          <Input
            id="acao-responsavel"
            value={responsavel}
            onChange={(event) => setResponsavel(event.target.value)}
          />
        </FormField>
      </div>
      <Button
        onClick={handleAdicionar}
        disabled={!descricao.trim() || !dataLimite || !responsavel.trim() || criarAcao.isPending}
      >
        {criarAcao.isPending ? 'Adicionando…' : '+ Adicionar ação corretiva'}
      </Button>
      {criarAcao.isError && <Alert>Não foi possível adicionar a ação corretiva.</Alert>}
    </div>
  )
}
