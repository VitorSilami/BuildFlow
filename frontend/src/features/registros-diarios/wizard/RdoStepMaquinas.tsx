import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import type { ApontamentoMaquinaInput, Equipe, MotivoParada } from '../../../types/registroDiario'
import { MAQUINA_VAZIA } from './valoresVazios'

interface RdoStepMaquinasProps {
  maquinas: ApontamentoMaquinaInput[]
  onMaquinasChange: Dispatch<SetStateAction<ApontamentoMaquinaInput[]>>
  equipeSelecionada: Equipe | undefined
  motivosParada: MotivoParada[]
}

export function RdoStepMaquinas({
  maquinas,
  onMaquinasChange,
  equipeSelecionada,
  motivosParada,
}: RdoStepMaquinasProps) {
  return (
    <div aria-label="Máquinas">
      {maquinas.map((maquina, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              id={`maquina-maquina-${index}`}
              label="Máquina cadastrada"
              value={maquina.maquina ?? ''}
              onChange={(value) => {
                onMaquinasChange((current) =>
                  current.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          maquina: value || undefined,
                          identificacao_avulsa: value ? '' : item.identificacao_avulsa,
                        }
                      : item,
                  ),
                )
              }}
              placeholder="Avulso (digitar identificação)"
              options={(equipeSelecionada?.maquinas ?? []).map((maq) => ({ value: maq.id, label: maq.nome }))}
            />
            {!maquina.maquina && (
              <FormField id={`maquina-identificacao-${index}`} label="Identificação (avulsa)">
                <Input
                  id={`maquina-identificacao-${index}`}
                  value={maquina.identificacao_avulsa ?? ''}
                  onChange={(event) =>
                    onMaquinasChange((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, identificacao_avulsa: event.target.value } : item,
                      ),
                    )
                  }
                />
              </FormField>
            )}
            <FormField id={`maquina-horas-produtivas-${index}`} label="Horas produtivas">
              <Input
                id={`maquina-horas-produtivas-${index}`}
                value={maquina.horas_produtivas}
                onChange={(event) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, horas_produtivas: event.target.value } : item,
                    ),
                  )
                }
              />
            </FormField>
            <FormField id={`maquina-horas-paradas-${index}`} label="Horas paradas">
              <Input
                id={`maquina-horas-paradas-${index}`}
                value={maquina.horas_paradas}
                onChange={(event) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, horas_paradas: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            {Number(maquina.horas_paradas) > 0 && (
              <SelectField
                id={`maquina-motivo-parada-${index}`}
                label="Motivo da parada"
                value={maquina.motivo_parada ? String(maquina.motivo_parada) : ''}
                onChange={(value) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, motivo_parada: Number(value) } : item)),
                  )
                }
                options={motivosParada.map((motivo) => ({ value: String(motivo.id), label: motivo.descricao }))}
              />
            )}
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onMaquinasChange((current) => [...current, MAQUINA_VAZIA])}
      >
        + Adicionar máquina
      </Button>
    </div>
  )
}
