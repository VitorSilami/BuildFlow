import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import type { Equipe, PresencaInput } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { PRESENCA_VAZIA } from './valoresVazios'

interface RdoStepEquipeProps {
  presencas: PresencaInput[]
  onPresencasChange: Dispatch<SetStateAction<PresencaInput[]>>
  equipeSelecionada: Equipe | undefined
}

export function RdoStepEquipe({ presencas, onPresencasChange, equipeSelecionada }: RdoStepEquipeProps) {
  return (
    <div aria-label="Equipe / presença">
      {presencas.map((presenca, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField id={`presenca-pessoa-${index}`} label="Pessoa cadastrada">
              <select
                id={`presenca-pessoa-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={presenca.pessoa ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  onPresencasChange((current) =>
                    current.map((item, i) =>
                      i === index
                        ? { ...item, pessoa: value || undefined, nome_avulso: value ? '' : item.nome_avulso }
                        : item,
                    ),
                  )
                }}
              >
                <option value="">Avulso (digitar nome)</option>
                {(equipeSelecionada?.pessoas ?? []).map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
              </select>
            </FormField>
            {!presenca.pessoa && (
              <FormField id={`presenca-nome-avulso-${index}`} label="Nome (avulso)">
                <Input
                  id={`presenca-nome-avulso-${index}`}
                  value={presenca.nome_avulso ?? ''}
                  onChange={(event) =>
                    onPresencasChange((current) =>
                      current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                    )
                  }
                />
              </FormField>
            )}
            <FormField id={`presenca-funcao-${index}`} label="Função">
              <Input
                id={`presenca-funcao-${index}`}
                value={presenca.funcao}
                onChange={(event) =>
                  onPresencasChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <SelectField
              id={`presenca-status-${index}`}
              label="Status"
              value={presenca.status}
              onChange={(value) =>
                onPresencasChange((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, status: value as PresencaInput['status'] } : item,
                  ),
                )
              }
              options={[
                { value: 'presente', label: 'Presente' },
                { value: 'falta', label: 'Falta' },
                { value: 'atestado', label: 'Atestado' },
              ]}
            />
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onPresencasChange((current) => [...current, PRESENCA_VAZIA])}
      >
        + Adicionar pessoa
      </Button>
    </div>
  )
}
