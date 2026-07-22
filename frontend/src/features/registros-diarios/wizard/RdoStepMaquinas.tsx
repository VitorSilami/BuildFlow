import { Minus, Plus } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import type { ApontamentoMaquinaInput, Equipe, MotivoParada } from '../../../types/registroDiario'
import { execucaoCorClasse } from '../../../lib/format'
import { MAQUINA_VAZIA } from './valoresVazios'

const PASSO_HORAS = 0.5
const CASAS_DECIMAIS = 1

interface RdoStepMaquinasProps {
  maquinas: ApontamentoMaquinaInput[]
  onMaquinasChange: Dispatch<SetStateAction<ApontamentoMaquinaInput[]>>
  equipeSelecionada: Equipe | undefined
  motivosParada: MotivoParada[]
}

function StepperHoras({
  id,
  label,
  valor,
  onChange,
}: {
  id: string
  label: string
  valor: string
  onChange: (valor: string) => void
}) {
  const numero = Number(valor) || 0

  function ajustar(delta: number) {
    const novoValor = Math.max(0, numero + delta)
    onChange(novoValor.toFixed(CASAS_DECIMAIS))
  }

  return (
    <FormField id={id} label={label}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Diminuir ${label.toLowerCase()}`}
          onClick={() => ajustar(-PASSO_HORAS)}
        >
          <Minus size={16} aria-hidden="true" />
        </Button>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={(event) => onChange(event.target.value)}
          className="w-20 text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          onClick={() => ajustar(PASSO_HORAS)}
        >
          <Plus size={16} aria-hidden="true" />
        </Button>
      </div>
    </FormField>
  )
}

export function RdoStepMaquinas({
  maquinas,
  onMaquinasChange,
  equipeSelecionada,
  motivosParada,
}: RdoStepMaquinasProps) {
  return (
    <div aria-label="Máquinas">
      {maquinas.map((maquina, index) => {
        const produtivas = Number(maquina.horas_produtivas) || 0
        const paradas = Number(maquina.horas_paradas) || 0
        const total = produtivas + paradas
        const eficienciaPercentual = total > 0 ? Math.round((produtivas / total) * 100) : 0

        return (
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
              <StepperHoras
                id={`maquina-horas-produtivas-${index}`}
                label="Horas produtivas"
                valor={maquina.horas_produtivas}
                onChange={(valor) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, horas_produtivas: valor } : item)),
                  )
                }
              />
              <StepperHoras
                id={`maquina-horas-paradas-${index}`}
                label="Horas paradas"
                valor={maquina.horas_paradas}
                onChange={(valor) =>
                  onMaquinasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, horas_paradas: valor } : item)),
                  )
                }
              />
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
            {total > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${execucaoCorClasse(String(eficienciaPercentual))}`}
                    style={{ width: `${eficienciaPercentual}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-muted-foreground">{eficienciaPercentual}%</span>
              </div>
            )}
          </fieldset>
        )
      })}
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
