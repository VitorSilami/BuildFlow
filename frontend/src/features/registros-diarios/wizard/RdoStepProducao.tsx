import { MapPin, Plus, Route, Trash2 } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, GrupoBotoes, Input } from '../../../components/ui'
import type { Disciplina, ProducaoDiariaInput, Unidade } from '../../../types/registroDiario'
import { NATIVE_SELECT_CLASSNAME } from './nativeSelectClassName'
import { RdoEmptyState, RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'
import { PRODUCAO_VAZIA } from './valoresVazios'

interface RdoStepProducaoProps {
  producoes: ProducaoDiariaInput[]
  onProducoesChange: Dispatch<SetStateAction<ProducaoDiariaInput[]>>
  disciplinas: Disciplina[]
  unidades: Unidade[]
}

function atualizarProducao(
  onProducoesChange: Dispatch<SetStateAction<ProducaoDiariaInput[]>>,
  index: number,
  patch: Partial<ProducaoDiariaInput>,
) {
  onProducoesChange((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
}

export function RdoStepProducao({ producoes, onProducoesChange, disciplinas, unidades }: RdoStepProducaoProps) {
  const linhasComServico = producoes.filter((item) => item.disciplina && item.servico).length
  const quantidadeInformada = producoes.filter((item) => item.quantidade).length

  function adicionarProducao() {
    onProducoesChange((current) => [...current, { ...PRODUCAO_VAZIA }])
  }

  function removerProducao(index: number) {
    onProducoesChange((current) => current.filter((_, i) => i !== index))
  }

  return (
    <RdoStepShell
      label="Produção do dia"
      title="Registre a produção por trecho"
      description="Cada linha representa um serviço executado em uma faixa de km. Separe linhas quando mudar serviço, unidade, sentido ou intervalo."
      actions={
        <Button type="button" variant="outline" onClick={adicionarProducao}>
          <Plus size={15} aria-hidden="true" />
          Adicionar produção
        </Button>
      }
      metrics={
        <>
          <RdoMetric label="Linhas" value={producoes.length} />
          <RdoMetric label="Com serviço" value={linhasComServico} tone={linhasComServico ? 'success' : 'warning'} />
          <RdoMetric label="Com quantidade" value={quantidadeInformada} tone={quantidadeInformada ? 'success' : 'warning'} />
          <RdoMetric label="Catálogo" value={`${disciplinas.length} disciplina(s)`} />
        </>
      }
    >
      {producoes.length > 0 ? (
        <div className="space-y-4">
          {producoes.map((producao, index) => (
            <fieldset key={index} className="rounded-lg border border-border bg-surface/30 p-4">
              <legend className="sr-only">Produção {index + 1}</legend>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-base font-semibold text-ink">Produção {index + 1}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {producao.rodovia || 'Rodovia pendente'} · {producao.km_inicial || 'km inicial'} até{' '}
                    {producao.km_final || 'km final'}
                  </p>
                </div>
                {producoes.length > 1 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => removerProducao(index)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Remover
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
                <RdoSection
                  title="Localização"
                  description="Identifique a rodovia, sentido e intervalo executado."
                  icon={<MapPin size={17} aria-hidden="true" />}
                  className="mb-0 bg-surface"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField id={`producao-rodovia-${index}`} label="Rodovia" className="sm:col-span-2">
                      <Input
                        id={`producao-rodovia-${index}`}
                        value={producao.rodovia}
                        placeholder="Ex.: BR-365"
                        onChange={(event) => atualizarProducao(onProducoesChange, index, { rodovia: event.target.value })}
                      />
                    </FormField>
                    <GrupoBotoes
                      id={`producao-sentido-${index}`}
                      label="Sentido"
                      value={producao.sentido}
                      onChange={(valor) => atualizarProducao(onProducoesChange, index, { sentido: valor })}
                      options={[
                        { value: 'crescente', label: 'Crescente' },
                        { value: 'decrescente', label: 'Decrescente' },
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField id={`producao-km-inicial-${index}`} label="Km inicial">
                        <div className="relative">
                          <MapPin
                            size={14}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <Input
                            id={`producao-km-inicial-${index}`}
                            value={producao.km_inicial}
                            placeholder="10.000"
                            className="pl-8"
                            onChange={(event) =>
                              atualizarProducao(onProducoesChange, index, { km_inicial: event.target.value })
                            }
                          />
                        </div>
                      </FormField>
                      <FormField id={`producao-km-final-${index}`} label="Km final">
                        <div className="relative">
                          <MapPin
                            size={14}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <Input
                            id={`producao-km-final-${index}`}
                            value={producao.km_final}
                            placeholder="10.500"
                            className="pl-8"
                            onChange={(event) =>
                              atualizarProducao(onProducoesChange, index, { km_final: event.target.value })
                            }
                          />
                        </div>
                      </FormField>
                    </div>
                  </div>
                </RdoSection>

                <RdoSection
                  title="Serviço executado"
                  description="Escolha o item de catálogo e informe o volume do dia."
                  icon={<Route size={17} aria-hidden="true" />}
                  className="mb-0 bg-surface"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField id={`producao-disciplina-${index}`} label="Disciplina">
                      <select
                        id={`producao-disciplina-${index}`}
                        className={NATIVE_SELECT_CLASSNAME}
                        value={producao.disciplina}
                        onChange={(event) =>
                          atualizarProducao(onProducoesChange, index, {
                            disciplina: event.target.value,
                            servico: '',
                          })
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
                        onChange={(event) => atualizarProducao(onProducoesChange, index, { servico: event.target.value })}
                      >
                        <option value="">Selecione…</option>
                        {(disciplinas.find((d) => d.id === producao.disciplina)?.servicos ?? []).map((servico) => (
                          <option key={servico.id} value={servico.id}>
                            {servico.nome}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField id={`producao-quantidade-${index}`} label="Quantidade">
                      <Input
                        id={`producao-quantidade-${index}`}
                        value={producao.quantidade}
                        inputMode="decimal"
                        placeholder="Ex.: 500"
                        onChange={(event) => atualizarProducao(onProducoesChange, index, { quantidade: event.target.value })}
                      />
                    </FormField>
                    <FormField id={`producao-unidade-${index}`} label="Unidade">
                      <select
                        id={`producao-unidade-${index}`}
                        className={NATIVE_SELECT_CLASSNAME}
                        value={producao.unidade ? String(producao.unidade) : ''}
                        onChange={(event) =>
                          atualizarProducao(onProducoesChange, index, { unidade: Number(event.target.value) })
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
                </RdoSection>
              </div>
            </fieldset>
          ))}
        </div>
      ) : (
        <RdoEmptyState
          title="Nenhuma produção lançada"
          description="Adicione ao menos uma produção para salvar o RDO do dia."
          icon={<Route size={18} aria-hidden="true" />}
        >
          <Button type="button" onClick={adicionarProducao}>
            <Plus size={15} aria-hidden="true" />
            Adicionar produção
          </Button>
        </RdoEmptyState>
      )}
    </RdoStepShell>
  )
}
