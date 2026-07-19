import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input } from '../../../components/ui'
import type { Disciplina, ProducaoDiariaInput, Unidade } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { PRODUCAO_VAZIA } from './valoresVazios'

interface RdoStepProducaoProps {
  producoes: ProducaoDiariaInput[]
  onProducoesChange: Dispatch<SetStateAction<ProducaoDiariaInput[]>>
  disciplinas: Disciplina[]
  unidades: Unidade[]
}

export function RdoStepProducao({ producoes, onProducoesChange, disciplinas, unidades }: RdoStepProducaoProps) {
  return (
    <div aria-label="Produção do dia">
      {producoes.map((producao, index) => (
        <fieldset key={index} className="mb-4 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField id={`producao-rodovia-${index}`} label="Rodovia">
              <Input
                id={`producao-rodovia-${index}`}
                value={producao.rodovia}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, rodovia: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-disciplina-${index}`} label="Disciplina">
              <select
                id={`producao-disciplina-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.disciplina}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, disciplina: event.target.value, servico: '' } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {disciplinas.map((disciplina) => (
                  <option key={disciplina.id} value={disciplina.id}>
                    {disciplina.nome}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`producao-servico-${index}`} label="Serviço">
              <select
                id={`producao-servico-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.servico}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, servico: event.target.value } : item)),
                  )
                }
              >
                <option value="">Selecione…</option>
                {(disciplinas.find((d) => d.id === producao.disciplina)?.servicos ?? []).map((servico) => (
                  <option key={servico.id} value={servico.id}>
                    {servico.nome}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={`producao-km-inicial-${index}`} label="Km inicial">
              <Input
                id={`producao-km-inicial-${index}`}
                value={producao.km_inicial}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_inicial: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-km-final-${index}`} label="Km final">
              <Input
                id={`producao-km-final-${index}`}
                value={producao.km_final}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, km_final: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-quantidade-${index}`} label="Quantidade">
              <Input
                id={`producao-quantidade-${index}`}
                value={producao.quantidade}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) => (i === index ? { ...item, quantidade: event.target.value } : item)),
                  )
                }
              />
            </FormField>
            <FormField id={`producao-unidade-${index}`} label="Unidade">
              <select
                id={`producao-unidade-${index}`}
                className={NATIVE_SELECT_CLASSNAME}
                value={producao.unidade ? String(producao.unidade) : ''}
                onChange={(event) =>
                  onProducoesChange((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, unidade: Number(event.target.value) } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione…</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={String(unidade.id)}>
                    {unidade.sigla}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onProducoesChange((current) => [...current, PRODUCAO_VAZIA])}
      >
        + Adicionar produção
      </Button>
    </div>
  )
}
