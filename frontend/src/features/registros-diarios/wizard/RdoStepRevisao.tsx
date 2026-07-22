import { Camera, CheckCircle2, Sparkles, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
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

function LinhaChecklist({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 border-b border-border py-2.5 text-sm last:border-b-0">
      <CheckCircle2 size={16} className="shrink-0 text-emerald-500" aria-hidden="true" />
      <span className="text-ink">{children}</span>
    </li>
  )
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
      <div className="mb-4 flex items-center gap-2 text-primary">
        <Sparkles size={18} aria-hidden="true" />
        <p className="font-display text-lg font-bold text-ink">Quase lá — confira e envie</p>
      </div>

      <dl className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-dashed border-border p-4 md:grid-cols-3">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Data</dt>
          <dd className="mt-1 font-display text-lg font-bold text-ink">{dataReferencia || '—'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Equipe</dt>
          <dd className="mt-1 font-display text-lg font-bold text-ink">{equipeSelecionada?.nome ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Fiscal</dt>
          <dd className="mt-1 font-display text-lg font-bold text-ink">{fiscalSelecionado?.nome ?? '—'}</dd>
        </div>
      </dl>

      <ul className="mb-4 rounded-lg border border-border px-4" aria-label="Resumo do registro">
        <LinhaChecklist>{producoes.length} produção(ões) lançada(s)</LinhaChecklist>
        <LinhaChecklist>{presencas.length} pessoa(s) na equipe</LinhaChecklist>
        <LinhaChecklist>{maquinas.length} máquina(s) apontada(s)</LinhaChecklist>
        <LinhaChecklist>{ocorrencias.length} ocorrência(s)</LinhaChecklist>
      </ul>

      <p className="mb-4 flex items-center gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
        <Camera size={16} className="shrink-0 text-primary" aria-hidden="true" />
        Fotos podem ser anexadas na próxima tela, depois de salvar este registro diário.
      </p>

      {erro && <Alert>{erro}</Alert>}

      <Button size="lg" className="gap-2" onClick={onSalvar} disabled={salvando}>
        <Zap size={16} aria-hidden="true" />
        {salvando ? 'Salvando…' : 'Salvar registro diário'}
      </Button>
    </div>
  )
}
