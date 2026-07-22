import { MapPin } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, Textarea } from '../../../components/ui'
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
          <FormField id={`ocorrencia-km-${index}`} label="Localização (km)">
            <div className="relative">
              <MapPin
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`ocorrencia-km-${index}`}
                value={ocorrencia.km ?? ''}
                placeholder="Ex.: 606.400"
                className="pl-8"
                onChange={(event) =>
                  onOcorrenciasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, km: event.target.value } : item)),
                  )
                }
              />
            </div>
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
