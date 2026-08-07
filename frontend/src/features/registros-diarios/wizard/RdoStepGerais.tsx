import { CalendarDays, Copy, Moon, Sun as SunIcon, UserRound, UsersRound } from 'lucide-react'
import { Button, FormField, GrupoBotoes, Input } from '../../../components/ui'
import { ICONE_CLIMA, LABEL_CLIMA } from '../climaIcons'
import type { Clima, Equipe, Fiscal, Turno } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'

interface RdoStepGeraisProps {
  dataReferencia: string
  onDataReferenciaChange: (value: string) => void
  turno: Turno
  onTurnoChange: (value: Turno) => void
  clima: Clima
  onClimaChange: (value: Clima) => void
  equipe: string
  onEquipeChange: (value: string) => void
  fiscal: string
  onFiscalChange: (value: string) => void
  equipes: Equipe[]
  fiscais: Fiscal[]
  podeDuplicarDiaAnterior: boolean
  onDuplicarDiaAnterior: () => void
}

export function RdoStepGerais({
  dataReferencia,
  onDataReferenciaChange,
  turno,
  onTurnoChange,
  clima,
  onClimaChange,
  equipe,
  onEquipeChange,
  fiscal,
  onFiscalChange,
  equipes,
  fiscais,
  podeDuplicarDiaAnterior,
  onDuplicarDiaAnterior,
}: RdoStepGeraisProps) {
  const equipeSelecionada = equipes.find((item) => item.id === equipe)
  const fiscalSelecionado = fiscais.find((item) => String(item.id) === fiscal)

  return (
    <RdoStepShell
      label="Dados gerais"
      title="Comece pelo contexto do dia"
      description="Defina data, frente, fiscal, turno e clima. A escolha da equipe também preenche presença e máquinas do pool para acelerar o restante do RDO."
      actions={
        podeDuplicarDiaAnterior ? (
          <Button type="button" variant="outline" onClick={onDuplicarDiaAnterior}>
            <Copy size={15} aria-hidden="true" />
            Duplicar dia anterior
          </Button>
        ) : undefined
      }
      metrics={
        <>
          <RdoMetric label="Data" value={dataReferencia || 'Pendente'} tone={dataReferencia ? 'success' : 'warning'} />
          <RdoMetric label="Equipe" value={equipeSelecionada?.nome ?? 'Pendente'} tone={equipe ? 'success' : 'warning'} />
          <RdoMetric label="Fiscal" value={fiscalSelecionado?.nome ?? 'Pendente'} tone={fiscal ? 'success' : 'warning'} />
          <RdoMetric label="Clima" value={LABEL_CLIMA[clima]} />
        </>
      }
    >
      <RdoSection
        title="Identificação"
        description="Campos que definem a qual dia e frente este registro pertence."
        icon={<CalendarDays size={17} aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FormField id="rdo-data" label="Data">
            <Input
              id="rdo-data"
              type="date"
              value={dataReferencia}
              onChange={(event) => onDataReferenciaChange(event.target.value)}
            />
          </FormField>
          <FormField id="rdo-equipe" label="Equipe">
            <select
              id="rdo-equipe"
              className={NATIVE_SELECT_CLASSNAME}
              value={equipe}
              onChange={(event) => onEquipeChange(event.target.value)}
            >
              <option value="">Selecione…</option>
              {equipes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="rdo-fiscal" label="Fiscal">
            <select
              id="rdo-fiscal"
              className={NATIVE_SELECT_CLASSNAME}
              value={fiscal}
              onChange={(event) => onFiscalChange(event.target.value)}
            >
              <option value="">Selecione…</option>
              {fiscais.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nome} ({item.email})
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </RdoSection>

      <RdoSection
        title="Condições do turno"
        description="Essas informações ajudam a explicar produtividade, paradas e ocorrências do dia."
        icon={<UsersRound size={17} aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <GrupoBotoes
            id="rdo-turno"
            label="Turno"
            value={turno}
            onChange={onTurnoChange}
            options={[
              { value: 'diurno', label: 'Diurno', icon: <SunIcon size={16} className="text-amber-400" aria-hidden="true" /> },
              { value: 'noturno', label: 'Noturno', icon: <Moon size={16} className="text-indigo-400" aria-hidden="true" /> },
            ]}
          />
          <GrupoBotoes
            id="rdo-clima"
            label="Clima"
            value={clima}
            onChange={onClimaChange}
            options={(Object.keys(LABEL_CLIMA) as Clima[]).map((valor) => ({
              value: valor,
              label: LABEL_CLIMA[valor],
              icon: ICONE_CLIMA[valor],
            }))}
          />
        </div>
      </RdoSection>

      {equipeSelecionada && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UsersRound size={15} className="text-primary" aria-hidden="true" />
              {equipeSelecionada.pessoas.length} pessoa(s) no pool da equipe
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Elas entram pré-marcadas como presentes na próxima etapa.</p>
          </div>
          <div className="rounded-lg border border-dashed border-border p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UserRound size={15} className="text-primary" aria-hidden="true" />
              Fiscal responsável: {fiscalSelecionado?.nome ?? 'selecione um fiscal'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Esse nome aparece na revisão e no detalhe do RDO.</p>
          </div>
        </div>
      )}
    </RdoStepShell>
  )
}
