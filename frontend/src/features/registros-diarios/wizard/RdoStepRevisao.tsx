import { CalendarDays, Camera, CheckCircle2, ClipboardCheck, Sparkles, UsersRound, Zap } from 'lucide-react'
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
import { RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'

interface RdoStepRevisaoProps {
  dataReferencia: string
  equipeSelecionada: Equipe | undefined
  fiscalSelecionado: Fiscal | undefined
  producoes: ProducaoDiariaInput[]
  presencas: PresencaInput[]
  maquinas: ApontamentoMaquinaInput[]
  ocorrencias: OcorrenciaInput[]
  totalFotos: number
  erro: string | null
  salvando: boolean
  onSalvar: () => void
}

function LinhaChecklist({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 border-b border-border py-2.5 text-sm last:border-b-0">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden="true" />
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
  totalFotos,
  erro,
  salvando,
  onSalvar,
}: RdoStepRevisaoProps) {
  const faltas = presencas.filter((item) => item.status === 'falta').length
  const maquinasComParada = maquinas.filter((item) => Number(item.horas_paradas) > 0).length

  return (
    <RdoStepShell
      label="Revisão"
      title="Quase lá — confira e envie"
      description="Revise os principais dados antes de salvar. Se algo estiver pendente, volte ao passo correspondente e ajuste sem perder o lançamento."
      metrics={
        <>
          <RdoMetric label="Produções" value={producoes.length} tone={producoes.length ? 'success' : 'warning'} />
          <RdoMetric label="Pessoas" value={presencas.length} />
          <RdoMetric label="Máquinas" value={maquinas.length} />
          <RdoMetric label="Fotos" value={totalFotos} tone={totalFotos ? 'success' : 'neutral'} />
        </>
      }
    >
      <RdoSection
        title="Dados principais"
        description="Identificação que será usada para encontrar este RDO depois."
        icon={<ClipboardCheck size={17} aria-hidden="true" />}
      >
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-dashed border-border p-3">
            <dt className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <CalendarDays size={13} aria-hidden="true" />
              Data
            </dt>
            <dd className="mt-1 font-display text-lg font-bold text-ink">{dataReferencia || '—'}</dd>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3">
            <dt className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <UsersRound size={13} aria-hidden="true" />
              Equipe
            </dt>
            <dd className="mt-1 font-display text-lg font-bold text-ink">{equipeSelecionada?.nome ?? '—'}</dd>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3">
            <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Fiscal</dt>
            <dd className="mt-1 font-display text-lg font-bold text-ink">{fiscalSelecionado?.nome ?? '—'}</dd>
          </div>
        </dl>
      </RdoSection>

      <RdoSection
        title="Checklist do registro"
        description="Resumo dos blocos que serão enviados para aprovação."
        icon={<Sparkles size={17} aria-hidden="true" />}
      >
        <ul className="rounded-lg border border-border px-4" aria-label="Resumo do registro">
          <LinhaChecklist>{producoes.length} produção(ões) lançada(s)</LinhaChecklist>
          <LinhaChecklist>
            {presencas.length} pessoa(s) na equipe{faltas > 0 ? `, com ${faltas} falta(s)` : ''}
          </LinhaChecklist>
          <LinhaChecklist>
            {maquinas.length} máquina(s) apontada(s){maquinasComParada > 0 ? `, com ${maquinasComParada} parada(s)` : ''}
          </LinhaChecklist>
          <LinhaChecklist>{ocorrencias.length} ocorrência(s)</LinhaChecklist>
          <LinhaChecklist>{totalFotos} foto(s) anexada(s)</LinhaChecklist>
        </ul>
      </RdoSection>

      <p className="flex items-start gap-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
        <Camera size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          {totalFotos > 0
            ? 'As fotos serão enviadas assim que o registro for salvo.'
            : 'Você ainda pode anexar fotos depois de salvar este registro diário.'}
        </span>
      </p>

      {erro && <Alert>{erro}</Alert>}

      <div className="flex justify-end">
        <Button size="lg" className="gap-2" onClick={onSalvar} disabled={salvando} aria-busy={salvando}>
          <Zap size={16} aria-hidden="true" />
          {salvando ? 'Salvando…' : 'Salvar registro diário'}
        </Button>
      </div>
    </RdoStepShell>
  )
}
