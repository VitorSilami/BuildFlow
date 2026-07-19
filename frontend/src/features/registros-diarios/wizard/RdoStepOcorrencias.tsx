import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Textarea } from '../../../components/ui'
import type { OcorrenciaInput } from '../../../types/registroDiario'
import { OCORRENCIA_VAZIA } from './valoresVazios'

interface RdoStepOcorrenciasProps {
  ocorrencias: OcorrenciaInput[]
  onOcorrenciasChange: Dispatch<SetStateAction<OcorrenciaInput[]>>
}

export function RdoStepOcorrencias({ ocorrencias, onOcorrenciasChange }: RdoStepOcorrenciasProps) {
  return (
    <div aria-label="Ocorrências">
      {ocorrencias.map((ocorrencia, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <FormField id={`ocorrencia-descricao-${index}`} label="Descrição">
            <Textarea
              id={`ocorrencia-descricao-${index}`}
              value={ocorrencia.descricao}
              onChange={(event) =>
                onOcorrenciasChange((current) =>
                  current.map((item, i) => (i === index ? { ...item, descricao: event.target.value } : item)),
                )
              }
            />
          </FormField>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onOcorrenciasChange((current) => [...current, OCORRENCIA_VAZIA])}
      >
        + Adicionar ocorrência
      </Button>
    </div>
  )
}
