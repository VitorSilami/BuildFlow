import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { toast } from '../../hooks/use-toast'
import { execucaoCorClasse, formatData, formatExecucao, statusEapCorClasse, statusEapLabel } from '../../lib/format'
import type { CatalogoServico, Disciplina } from '../../types/configuracao'
import type { Unidade } from '../../types/registroDiario'
import { Button, FormField, Input, Progress, SelectField } from '../../components/ui'
import { CartaControleChart } from './CartaControleChart'
import { useAtualizarDisciplina, useAtualizarServico, useCriarDisciplina, useCriarServico } from './configuracaoApi'

const TOLERANCIA_SOMA_PESOS = 0.01

function somaPesosFilhos(disciplina: Disciplina): number {
  const somaServicos = disciplina.servicos.reduce(
    (total, servico) => total + (servico.peso_percentual ? Number(servico.peso_percentual) : 0),
    0,
  )
  const somaSubdisciplinas = disciplina.subdisciplinas.reduce(
    (total, subdisciplina) => total + (subdisciplina.peso_percentual ? Number(subdisciplina.peso_percentual) : 0),
    0,
  )
  return somaServicos + somaSubdisciplinas
}

interface EapDisciplinaCardProps {
  projetoId: string
  disciplina: Disciplina
  unidades: Unidade[]
}

export function EapDisciplinaCard({ projetoId, disciplina, unidades }: EapDisciplinaCardProps) {
  const [expandido, setExpandido] = useState(false)
  const [peso, setPeso] = useState(disciplina.peso_percentual ?? '')
  const [novoServicoNome, setNovoServicoNome] = useState('')
  const [novoServicoUnidade, setNovoServicoUnidade] = useState('')
  const [novoServicoPeso, setNovoServicoPeso] = useState('')
  const [novoServicoQuantidade, setNovoServicoQuantidade] = useState('')
  const [novaSubdisciplinaNome, setNovaSubdisciplinaNome] = useState('')

  const atualizarDisciplina = useAtualizarDisciplina(projetoId)
  const criarServico = useCriarServico(projetoId)
  const criarDisciplina = useCriarDisciplina(projetoId)

  const somaFilhos = somaPesosFilhos(disciplina)
  const temFilhos = disciplina.servicos.length > 0 || disciplina.subdisciplinas.length > 0
  const somaFilhosForaDoAlvo = temFilhos && Math.abs(somaFilhos - 100) > TOLERANCIA_SOMA_PESOS

  function salvarPesoDisciplina() {
    if (peso === (disciplina.peso_percentual ?? '')) return
    atualizarDisciplina.mutate(
      { disciplinaId: disciplina.id, peso_percentual: peso },
      { onError: () => toast({ title: 'Não foi possível atualizar o peso da disciplina.', variant: 'destructive' }) },
    )
  }

  return (
    <li className="rounded-lg border border-border p-3 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpandido((valor) => !valor)}
          aria-expanded={expandido}
          aria-label={expandido ? `Recolher ${disciplina.nome}` : `Expandir ${disciplina.nome}`}
          className="text-muted-foreground hover:text-ink"
        >
          {expandido ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
        <ListChecks size={14} className="text-primary" aria-hidden="true" />
        <span className="flex-1 font-display font-semibold">{disciplina.nome}</span>
        <div className="flex w-40 items-center gap-2">
          <Progress
            value={disciplina.avanco_percentual ? Number(disciplina.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(disciplina.avanco_percentual)}
          />
          <span className="w-12 text-right text-xs text-muted-foreground">
            {formatExecucao(disciplina.avanco_percentual)}
          </span>
          {disciplina.status_eap !== null && (
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(disciplina.status_eap)}`}
            >
              {statusEapLabel(disciplina.status_eap)}
            </span>
          )}
        </div>
        <FormField id={`peso-disciplina-${disciplina.id}`} label="Peso (%)" className="mb-0 w-24">
          <Input
            id={`peso-disciplina-${disciplina.id}`}
            value={peso}
            onChange={(event) => setPeso(event.target.value)}
            onBlur={salvarPesoDisciplina}
          />
        </FormField>
      </div>

      {expandido && (
        <div className="mt-3 pl-7">
          {!temFilhos && (
            <p className="mb-3 text-xs text-muted-foreground">
              Nenhuma subdisciplina ou serviço cadastrado nesta disciplina ainda.
            </p>
          )}

          {disciplina.subdisciplinas.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {disciplina.subdisciplinas.map((subdisciplina) => (
                <EapDisciplinaCard
                  key={subdisciplina.id}
                  projetoId={projetoId}
                  disciplina={subdisciplina}
                  unidades={unidades}
                />
              ))}
            </ul>
          )}

          {disciplina.servicos.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {disciplina.servicos.map((servico) => (
                <EapServicoRow key={servico.id} projetoId={projetoId} servico={servico} />
              ))}
            </ul>
          )}

          {somaFilhosForaDoAlvo && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
              Atenção: a soma dos pesos dos filhos desta disciplina não fecha 100% ({somaFilhos}%).
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-end gap-3">
            <FormField id={`nova-subdisciplina-${disciplina.id}`} label="Nova subdisciplina">
              <Input
                id={`nova-subdisciplina-${disciplina.id}`}
                value={novaSubdisciplinaNome}
                onChange={(event) => setNovaSubdisciplinaNome(event.target.value)}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              disabled={!novaSubdisciplinaNome.trim() || criarDisciplina.isPending}
              onClick={() =>
                criarDisciplina.mutate(
                  { nome: novaSubdisciplinaNome, pai: disciplina.id },
                  {
                    onSuccess: () => setNovaSubdisciplinaNome(''),
                    onError: () =>
                      toast({ title: 'Não foi possível criar a subdisciplina.', variant: 'destructive' }),
                  },
                )
              }
            >
              + Subdisciplina
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <SelectField
              id={`novo-servico-unidade-${disciplina.id}`}
              label="Unidade"
              value={novoServicoUnidade}
              onChange={setNovoServicoUnidade}
              options={unidades.map((unidade) => ({ value: String(unidade.id), label: unidade.sigla }))}
            />
            <FormField id={`novo-servico-nome-${disciplina.id}`} label="Novo serviço">
              <Input
                id={`novo-servico-nome-${disciplina.id}`}
                value={novoServicoNome}
                onChange={(event) => setNovoServicoNome(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-peso-${disciplina.id}`} label="Peso (%)">
              <Input
                id={`novo-servico-peso-${disciplina.id}`}
                value={novoServicoPeso}
                onChange={(event) => setNovoServicoPeso(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-quantidade-${disciplina.id}`} label="Quantidade planejada">
              <Input
                id={`novo-servico-quantidade-${disciplina.id}`}
                value={novoServicoQuantidade}
                onChange={(event) => setNovoServicoQuantidade(event.target.value)}
              />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!novoServicoNome.trim() || !novoServicoUnidade || criarServico.isPending}
                onClick={() =>
                  criarServico.mutate(
                    {
                      disciplinaId: disciplina.id,
                      nome: novoServicoNome,
                      unidade: Number(novoServicoUnidade),
                      peso_percentual: novoServicoPeso || undefined,
                      quantidade_planejada: novoServicoQuantidade || undefined,
                    },
                    {
                      onSuccess: () => {
                        setNovoServicoNome('')
                        setNovoServicoPeso('')
                        setNovoServicoQuantidade('')
                      },
                      onError: () => toast({ title: 'Não foi possível adicionar o serviço.', variant: 'destructive' }),
                    },
                  )
                }
              >
                Adicionar serviço
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

interface EapServicoRowProps {
  projetoId: string
  servico: CatalogoServico
}

function EapServicoRow({ projetoId, servico }: EapServicoRowProps) {
  const [peso, setPeso] = useState(servico.peso_percentual ?? '')
  const [quantidadePlanejada, setQuantidadePlanejada] = useState(servico.quantidade_planejada ?? '')
  const [quantidadeExecutadaManual, setQuantidadeExecutadaManual] = useState(servico.quantidade_executada_manual)
  const [dataInicioPrevista, setDataInicioPrevista] = useState(servico.data_inicio_prevista ?? '')
  const [dataFimPrevista, setDataFimPrevista] = useState(servico.data_fim_prevista ?? '')
  const [lancamentosVisiveis, setLancamentosVisiveis] = useState(false)

  const atualizarServico = useAtualizarServico(projetoId)

  function salvar(
    campo:
      | 'peso_percentual'
      | 'quantidade_planejada'
      | 'quantidade_executada_manual'
      | 'data_inicio_prevista'
      | 'data_fim_prevista',
    valor: string | null,
    valorOriginal: string | null,
  ) {
    if (valor === valorOriginal) return
    atualizarServico.mutate(
      { servicoId: servico.id, [campo]: valor },
      { onError: () => toast({ title: 'Não foi possível atualizar o serviço.', variant: 'destructive' }) },
    )
  }

  const somaRdo = (Number(servico.quantidade_executada) - Number(servico.quantidade_executada_manual)).toFixed(3)

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 font-medium text-ink">{servico.nome}</span>
        <div className="flex w-32 items-center gap-2">
          <Progress
            value={servico.avanco_percentual ? Number(servico.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(servico.avanco_percentual)}
          />
          <span className="w-10 text-right text-muted-foreground">{formatExecucao(servico.avanco_percentual)}</span>
        </div>
        <FormField id={`servico-peso-${servico.id}`} label="Peso (%)" className="mb-0 w-20">
          <Input
            id={`servico-peso-${servico.id}`}
            value={peso}
            onChange={(event) => setPeso(event.target.value)}
            onBlur={() => salvar('peso_percentual', peso, servico.peso_percentual ?? '')}
          />
        </FormField>
        <FormField id={`servico-planejada-${servico.id}`} label="Planejada" className="mb-0 w-24">
          <Input
            id={`servico-planejada-${servico.id}`}
            value={quantidadePlanejada}
            onChange={(event) => setQuantidadePlanejada(event.target.value)}
            onBlur={() => salvar('quantidade_planejada', quantidadePlanejada, servico.quantidade_planejada ?? '')}
          />
        </FormField>
        <FormField id={`servico-ajuste-${servico.id}`} label="Ajuste manual" className="mb-0 w-24">
          <Input
            id={`servico-ajuste-${servico.id}`}
            value={quantidadeExecutadaManual}
            onChange={(event) => setQuantidadeExecutadaManual(event.target.value)}
            onBlur={() =>
              salvar('quantidade_executada_manual', quantidadeExecutadaManual, servico.quantidade_executada_manual)
            }
          />
        </FormField>
        <FormField id={`servico-inicio-${servico.id}`} label="Início previsto" className="mb-0 w-40">
          <Input
            id={`servico-inicio-${servico.id}`}
            type="date"
            value={dataInicioPrevista}
            onChange={(event) => setDataInicioPrevista(event.target.value)}
            onBlur={() =>
              salvar(
                'data_inicio_prevista',
                dataInicioPrevista === '' ? null : dataInicioPrevista,
                servico.data_inicio_prevista,
              )
            }
          />
        </FormField>
        <FormField id={`servico-fim-${servico.id}`} label="Fim previsto" className="mb-0 w-40">
          <Input
            id={`servico-fim-${servico.id}`}
            type="date"
            value={dataFimPrevista}
            onChange={(event) => setDataFimPrevista(event.target.value)}
            onBlur={() =>
              salvar('data_fim_prevista', dataFimPrevista === '' ? null : dataFimPrevista, servico.data_fim_prevista)
            }
          />
        </FormField>
        {servico.status_eap !== null && (
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(servico.status_eap)}`}
          >
            {statusEapLabel(servico.status_eap)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1 text-muted-foreground">
        <span>
          Executado: <span className="font-semibold text-ink">{servico.quantidade_executada}</span> (RDO: {somaRdo}
          {' + ajuste manual: '}
          {servico.quantidade_executada_manual})
        </span>
        {servico.avanco_previsto_percentual !== null && <span>Previsto: {servico.avanco_previsto_percentual}%</span>}
        {servico.producoes_vinculadas.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setLancamentosVisiveis((valor) => !valor)}>
            {lancamentosVisiveis ? 'Ocultar lançamentos' : `Ver lançamentos (${servico.producoes_vinculadas.length})`}
          </Button>
        )}
      </div>
      {lancamentosVisiveis && (
        <>
          {servico.carta_controle && <CartaControleChart cartaControle={servico.carta_controle} />}
          <ul className="flex flex-col gap-1 pl-1 text-muted-foreground">
            {servico.producoes_vinculadas.map((producao, indice) => (
              <li key={`${producao.data_referencia}-${producao.quantidade}-${indice}`}>
                {formatData(producao.data_referencia)} — {producao.quantidade}
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  )
}
