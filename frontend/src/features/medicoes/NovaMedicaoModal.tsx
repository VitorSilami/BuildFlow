import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  SelectField,
} from '../../components/ui'
import { toast } from '../../hooks/use-toast'
import { useConfiguracaoRdo } from '../registros-diarios/registrosDiariosApi'
import { ApiError } from '../../services/apiClient'
import { useCriarMedicao } from './medicoesApi'

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

interface NovaMedicaoModalProps {
  projetoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NovaMedicaoModal({ projetoId, open, onOpenChange }: NovaMedicaoModalProps) {
  const navigate = useNavigate()
  const configuracaoRdo = useConfiguracaoRdo(projetoId)
  const criarMedicao = useCriarMedicao(projetoId)
  const [dataCorte, setDataCorte] = useState(hoje)
  const [fiscal, setFiscal] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const fiscais = configuracaoRdo.data?.fiscais ?? []

  async function criar() {
    setErro(null)
    try {
      const medicao = await criarMedicao.mutateAsync({ data_corte: dataCorte, fiscal: Number(fiscal) })
      onOpenChange(false)
      toast({ title: 'Medição criada.', variant: 'success' })
      navigate(`/projetos/${projetoId}/medicoes/${medicao.id}`)
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível criar a medição.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova medição</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="medicao-data-corte">Data de corte</Label>
          <input
            id="medicao-data-corte"
            type="date"
            value={dataCorte}
            max={hoje()}
            onChange={(event) => setDataCorte(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <SelectField
          id="medicao-fiscal"
          label="Fiscal"
          value={fiscal}
          onChange={setFiscal}
          options={fiscais.map((item) => ({ value: String(item.id), label: item.nome }))}
          placeholder="Selecione o fiscal…"
        />

        {erro && <Alert>{erro}</Alert>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void criar()} disabled={!fiscal || criarMedicao.isPending}>
            {criarMedicao.isPending ? 'Criando…' : 'Criar medição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
