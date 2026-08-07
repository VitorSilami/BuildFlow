import { Gauge, Plus, Trash2, Truck } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button, FormField, Input, SelectField } from '../../../components/ui'
import { execucaoCorClasse } from '../../../lib/format'
import type { ApontamentoMaquinaInput, Equipe, MotivoParada } from '../../../types/registroDiario'
import { RdoEmptyState, RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'
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
          <span aria-hidden="true">−</span>
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
          <span aria-hidden="true">+</span>
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
  const totalParadas = maquinas.reduce((soma, item) => soma + (Number(item.horas_paradas) || 0), 0)
  const totalProdutivas = maquinas.reduce((soma, item) => soma + (Number(item.horas_produtivas) || 0), 0)
  const totalGeral = totalProdutivas + totalParadas
  const eficienciaMedia = totalGeral > 0 ? Math.round((totalProdutivas / totalGeral) * 100) : null

  const maquinasNoPool = equipeSelecionada?.maquinas ?? []
  const disponiveisNoPool = maquinasNoPool.filter(
    (maquina) => !maquinas.some((item) => item.maquina === maquina.id),
  ).length

  function nomeMaquina(maquina: ApontamentoMaquinaInput): { nome: string; codigo: string | null } {
    if (maquina.maquina) {
      const encontrada = maquinasNoPool.find((item) => item.id === maquina.maquina)
      return { nome: encontrada?.nome ?? '—', codigo: encontrada?.codigo ?? null }
    }
    return { nome: maquina.identificacao_avulsa || 'Nova máquina', codigo: null }
  }

  function adicionarMaquina() {
    onMaquinasChange((current) => [...current, { ...MAQUINA_VAZIA }])
  }

  function removerMaquina(index: number) {
    onMaquinasChange((current) => current.filter((_, i) => i !== index))
  }

  return (
    <RdoStepShell
      label="Máquinas"
      title="Aponte máquinas e eficiência"
      description="Digite as horas direto no campo ou ajuste em passos de meia hora. Quando houver parada, informe o motivo para o registro ficar completo."
      actions={
        <Button type="button" variant="outline" onClick={adicionarMaquina}>
          <Plus size={15} aria-hidden="true" />
          Adicionar máquina
        </Button>
      }
      metrics={
        <>
          <RdoMetric label="Máquinas" value={maquinas.length} />
          <RdoMetric label="Produtivas" value={`${totalProdutivas.toFixed(CASAS_DECIMAIS)} h`} tone="success" />
          <RdoMetric label="Paradas" value={`${totalParadas.toFixed(CASAS_DECIMAIS)} h`} tone={totalParadas ? 'warning' : 'neutral'} />
          <RdoMetric label="Eficiência média" value={eficienciaMedia !== null ? `${eficienciaMedia}%` : '—'} />
        </>
      }
    >
      <RdoSection
        title={equipeSelecionada?.nome ? `Pool de ${equipeSelecionada.nome}` : 'Máquinas do dia'}
        description="Revise o pool carregado pela equipe e acrescente equipamentos avulsos quando necessário."
        icon={<Gauge size={17} aria-hidden="true" />}
      >
        {maquinas.length === 0 ? (
          <RdoEmptyState
            title="Nenhuma máquina apontada"
            description="Adicione uma máquina do pool ou cadastre um equipamento avulso para registrar as horas do dia."
            icon={<Truck size={18} aria-hidden="true" />}
          >
            <Button type="button" onClick={adicionarMaquina}>
              <Plus size={15} aria-hidden="true" />
              Adicionar máquina
            </Button>
          </RdoEmptyState>
        ) : (
          <div className="space-y-4">
            {maquinas.map((maquina, index) => {
              const produtivas = Number(maquina.horas_produtivas) || 0
              const paradas = Number(maquina.horas_paradas) || 0
              const total = produtivas + paradas
              const eficienciaPercentual = total > 0 ? Math.round((produtivas / total) * 100) : 0
              const { nome, codigo } = nomeMaquina(maquina)

              return (
                <fieldset key={index} className="rounded-lg border border-border bg-surface/30 p-4">
                  <legend className="sr-only">Máquina {index + 1}</legend>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Truck size={18} aria-hidden="true" />
                      </span>
                      {maquina.maquina ? (
                        <div className="min-w-0">
                          <p className="truncate font-display font-bold text-ink">{nome}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {codigo} · total apontado: {total.toFixed(CASAS_DECIMAIS)} h
                          </p>
                        </div>
                      ) : (
                        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
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
                            options={maquinasNoPool.map((maq) => ({ value: maq.id, label: maq.nome }))}
                          />
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
                        </div>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="shrink-0 text-right">
                        <p className={`font-display text-lg font-bold ${execucaoCorClasse(String(eficienciaPercentual)).replace('bg-', 'text-')}`}>
                          {eficienciaPercentual}%
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Eficiência</p>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Remover máquina ${index + 1}`}
                      onClick={() => removerMaquina(index)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  </div>
                  {Number(maquina.horas_paradas) > 0 && (
                    <div className="mt-4">
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
                    </div>
                  )}
                  {total > 0 && (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${execucaoCorClasse(String(eficienciaPercentual))}`}
                        style={{ width: `${eficienciaPercentual}%` }}
                      />
                    </div>
                  )}
                </fieldset>
              )
            })}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={adicionarMaquina}
            disabled={disponiveisNoPool === 0}
            className="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
          >
            <Plus size={16} aria-hidden="true" />
            Adicionar máquina do pool ({disponiveisNoPool} disponíve{disponiveisNoPool === 1 ? 'l' : 'is'})
          </button>
          <button
            type="button"
            onClick={adicionarMaquina}
            className="flex min-h-[3.5rem] items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={16} aria-hidden="true" />
            Cadastrar máquina avulsa (não está no pool)
          </button>
        </div>
      </RdoSection>
    </RdoStepShell>
  )
}
