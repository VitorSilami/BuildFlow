import { Button, FormField, Input } from '../../../components/ui'
import type { Clima, Equipe, Fiscal, Turno } from '../../../types/registroDiario'
import { GrupoBotoes } from './GrupoBotoes'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'

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
  return (
    <div aria-label="Dados gerais">
      {podeDuplicarDiaAnterior && (
        <Button type="button" variant="outline" className="mb-4" onClick={onDuplicarDiaAnterior}>
          Duplicar dia anterior
        </Button>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GrupoBotoes
          id="rdo-turno"
          label="Turno"
          value={turno}
          onChange={onTurnoChange}
          options={[
            { value: 'diurno', label: 'Diurno' },
            { value: 'noturno', label: 'Noturno' },
          ]}
        />
        <GrupoBotoes
          id="rdo-clima"
          label="Clima"
          value={clima}
          onChange={onClimaChange}
          options={[
            { value: 'sol', label: 'Sol' },
            { value: 'nublado', label: 'Nublado' },
            { value: 'chuva', label: 'Chuva' },
            { value: 'chuva_forte', label: 'Chuva forte' },
          ]}
        />
      </div>
    </div>
  )
}
