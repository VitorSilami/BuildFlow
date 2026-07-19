import { Alert, Button } from '../../../components/ui'
import type {
  ApontamentoMaquinaInput,
  Equipe,
  Fiscal,
  OcorrenciaInput,
  PresencaInput,
  ProducaoDiariaInput,
} from '../../../types/registroDiario'

interface RdoStepRevisaoProps {
  dataReferencia: string
  equipeSelecionada: Equipe | undefined
  fiscalSelecionado: Fiscal | undefined
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
  erro: string | null
  salvando: boolean
  onSalvar: () => void
}

export function RdoStepRevisao({
  dataReferencia,
  equipeSelecionada,
  fiscalSelecionado,
  producoes,
  presencas,
  maquinas,
  ocorrencias,
  erro,
  salvando,
  onSalvar,
}: RdoStepRevisaoProps) {
  return (
    <div aria-label="Revisão">
      <dl className="mb-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Data</dt>
          <dd className="font-medium text-ink">{dataReferencia || '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Equipe</dt>
          <dd className="font-medium text-ink">{equipeSelecionada?.nome ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Fiscal</dt>
          <dd className="font-medium text-ink">{fiscalSelecionado?.nome ?? '—'}</dd>
        </div>
      </dl>

      <ul className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground" aria-label="Resumo do registro">
        <li>{producoes.length} produção(ões) lançada(s)</li>
        <li>{presencas.length} pessoa(s) na equipe</li>
        <li>{maquinas.length} máquina(s) apontada(s)</li>
        <li>{ocorrencias.length} ocorrência(s)</li>
      </ul>

      <p className="mb-4 rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
        Fotos podem ser anexadas na próxima tela, depois de salvar este registro diário.
      </p>

      {erro && <Alert>{erro}</Alert>}

      <Button size="lg" onClick={onSalvar} disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar registro diário'}
      </Button>
    </div>
  )
}
