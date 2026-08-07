import { AlertTriangle, MapPin, Plus, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, Textarea } from '../../../components/ui'
import type { OcorrenciaInput } from '../../../types/registroDiario'
import { RdoEmptyState, RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'
import { OCORRENCIA_VAZIA } from './valoresVazios'

interface RdoStepOcorrenciasProps {
  ocorrencias: OcorrenciaInput[]
  onOcorrenciasChange: Dispatch<SetStateAction<OcorrenciaInput[]>>
}

function atualizarOcorrencia(
  onOcorrenciasChange: Dispatch<SetStateAction<OcorrenciaInput[]>>,
  index: number,
  patch: Partial<OcorrenciaInput>,
) {
  onOcorrenciasChange((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
}

export function RdoStepOcorrencias({ ocorrencias, onOcorrenciasChange }: RdoStepOcorrenciasProps) {
  const comKm = ocorrencias.filter((item) => item.km).length
  const completas = ocorrencias.filter((item) => item.descricao.trim()).length

  function adicionarOcorrencia() {
    onOcorrenciasChange((current) => [...current, { ...OCORRENCIA_VAZIA }])
  }

  function removerOcorrencia(index: number) {
    onOcorrenciasChange((current) => current.filter((_, i) => i !== index))
  }

  return (
    <RdoStepShell
      label="Ocorrências"
      title="Registre impedimentos e fatos relevantes"
      description="Use esta etapa para anotar interferências, segurança, clima, parada de recurso ou qualquer fato que explique o dia."
      actions={
        <Button type="button" variant="outline" onClick={adicionarOcorrencia}>
          <Plus size={15} aria-hidden="true" />
          Adicionar ocorrência
        </Button>
      }
      metrics={
        <>
          <RdoMetric label="Ocorrências" value={ocorrencias.length} tone={ocorrencias.length ? 'warning' : 'neutral'} />
          <RdoMetric label="Com descrição" value={completas} tone={completas === ocorrencias.length ? 'success' : 'warning'} />
          <RdoMetric label="Com km" value={comKm} />
          <RdoMetric label="Pendências" value={ocorrencias.length - completas} tone={ocorrencias.length - completas ? 'danger' : 'success'} />
        </>
      }
    >
      <RdoSection
        title="Lista de ocorrências"
        description="Quando não houve nada relevante, deixe a lista vazia e avance para fotos."
        icon={<AlertTriangle size={17} aria-hidden="true" />}
      >
        {ocorrencias.length > 0 ? (
          <div className="space-y-4">
            {ocorrencias.map((ocorrencia, index) => (
              <fieldset key={index} className="rounded-lg border border-border bg-surface/30 p-4">
                <legend className="sr-only">Ocorrência {index + 1}</legend>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-ink">Ocorrência {index + 1}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ocorrencia.km ? `Localizada no km ${ocorrencia.km}` : 'Km opcional, descrição obrigatória.'}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removerOcorrencia(index)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Remover
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
                  <FormField id={`ocorrencia-descricao-${index}`} label="Descrição">
                    <Textarea
                      id={`ocorrencia-descricao-${index}`}
                      value={ocorrencia.descricao}
                      placeholder="Descreva o fato, impacto e encaminhamento."
                      className="min-h-28"
                      onChange={(event) =>
                        atualizarOcorrencia(onOcorrenciasChange, index, { descricao: event.target.value })
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
                        onChange={(event) => atualizarOcorrencia(onOcorrenciasChange, index, { km: event.target.value })}
                      />
                    </div>
                  </FormField>
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <RdoEmptyState
            title="Sem ocorrências no dia"
            description="Ótimo. Se algo surgir, adicione uma ocorrência com descrição e km quando fizer sentido."
            icon={<AlertTriangle size={18} aria-hidden="true" />}
          >
            <Button type="button" onClick={adicionarOcorrencia}>
              <Plus size={15} aria-hidden="true" />
              Adicionar ocorrência
            </Button>
          </RdoEmptyState>
        )}
      </RdoSection>
    </RdoStepShell>
  )
}
