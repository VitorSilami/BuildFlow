import { Plus, UserCheck, UsersRound, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Avatar, AvatarFallback, Button, Input } from '../../../components/ui'
import type { Equipe, PresencaInput, StatusPresenca } from '../../../types/registroDiario'
import { RdoEmptyState, RdoMetric, RdoSection, RdoStepShell } from './RdoStepShell'
import { PRESENCA_VAZIA } from './valoresVazios'

interface RdoStepEquipeProps {
  presencas: PresencaInput[]
  onPresencasChange: Dispatch<SetStateAction<PresencaInput[]>>
  equipeSelecionada: Equipe | undefined
}

const STATUS_OPCOES: { value: StatusPresenca; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'falta', label: 'Falta' },
  { value: 'atestado', label: 'Atestado' },
]

const CARTAO_BORDA: Record<StatusPresenca, string> = {
  presente: 'border-emerald-500/40 bg-emerald-500/5',
  falta: 'border-red-500/40 bg-red-500/5',
  atestado: 'border-amber-500/40 bg-amber-500/5',
}

const BOTAO_ATIVO: Record<StatusPresenca, string> = {
  presente: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  falta: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300',
  atestado: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function RdoStepEquipe({ presencas, onPresencasChange, equipeSelecionada }: RdoStepEquipeProps) {
  const contagem = {
    presente: presencas.filter((item) => item.status === 'presente').length,
    falta: presencas.filter((item) => item.status === 'falta').length,
    atestado: presencas.filter((item) => item.status === 'atestado').length,
  }

  function nomeExibicao(presenca: PresencaInput): string {
    if (presenca.pessoa) {
      return equipeSelecionada?.pessoas.find((pessoa) => pessoa.id === presenca.pessoa)?.nome ?? '—'
    }
    return presenca.nome_avulso || 'Nova pessoa'
  }

  function atualizarStatus(index: number, status: StatusPresenca) {
    onPresencasChange((current) => current.map((item, i) => (i === index ? { ...item, status } : item)))
  }

  function marcarTodosPresentes() {
    onPresencasChange((current) => current.map((item) => ({ ...item, status: 'presente' })))
  }

  function removerPresenca(index: number) {
    onPresencasChange((current) => current.filter((_, i) => i !== index))
  }

  function adicionarReforco() {
    onPresencasChange((current) => [...current, { ...PRESENCA_VAZIA }])
  }

  return (
    <RdoStepShell
      label="Equipe / presença"
      title="Confira a presença da frente"
      description="A equipe selecionada já vem pré-marcada como presente. Ajuste faltas, atestados e reforços sem reconstruir a lista."
      actions={
        <>
          <Button type="button" variant="outline" onClick={marcarTodosPresentes} disabled={presencas.length === 0}>
            <UserCheck size={15} aria-hidden="true" />
            Marcar todos presentes
          </Button>
          <Button type="button" variant="outline" onClick={adicionarReforco}>
            <Plus size={15} aria-hidden="true" />
            Adicionar pessoa na frente
          </Button>
        </>
      }
      metrics={
        <>
          <RdoMetric label="Presentes" value={contagem.presente} tone="success" />
          <RdoMetric label="Faltas" value={contagem.falta} tone={contagem.falta ? 'danger' : 'neutral'} />
          <RdoMetric label="Atestados" value={contagem.atestado} tone={contagem.atestado ? 'warning' : 'neutral'} />
          <RdoMetric label="Total" value={presencas.length} />
        </>
      }
    >
      <RdoSection
        title={equipeSelecionada?.nome ?? 'Equipe ainda não selecionada'}
        description={
          equipeSelecionada
            ? 'Revise cada pessoa do pool e adicione reforços avulsos quando necessário.'
            : 'Selecione uma equipe no passo anterior para carregar o pool automaticamente.'
        }
        icon={<UsersRound size={17} aria-hidden="true" />}
      >
        {presencas.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {presencas.map((presenca, index) => (
              <div
                key={index}
                className={`relative rounded-lg border p-3 transition-colors ${CARTAO_BORDA[presenca.status]}`}
              >
                {!presenca.pessoa && (
                  <button
                    type="button"
                    aria-label={`Remover pessoa ${index + 1}`}
                    onClick={() => removerPresenca(index)}
                    className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
                <div className="mb-3 flex items-center gap-2.5 pr-7">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs font-bold">{iniciais(nomeExibicao(presenca))}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    {presenca.pessoa ? (
                      <p className="truncate text-sm font-bold text-ink">{nomeExibicao(presenca)}</p>
                    ) : (
                      <Input
                        aria-label="Nome (avulso)"
                        value={presenca.nome_avulso ?? ''}
                        placeholder="Nome"
                        className="h-8 px-2 text-sm font-bold"
                        onChange={(event) =>
                          onPresencasChange((current) =>
                            current.map((item, i) => (i === index ? { ...item, nome_avulso: event.target.value } : item)),
                          )
                        }
                      />
                    )}
                    {presenca.pessoa ? (
                      <p className="truncate text-xs text-muted-foreground">{presenca.funcao || '—'}</p>
                    ) : (
                      <Input
                        aria-label="Função"
                        value={presenca.funcao}
                        placeholder="Função"
                        className="mt-1 h-7 px-2 text-xs"
                        onChange={(event) =>
                          onPresencasChange((current) =>
                            current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                          )
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Status da pessoa ${index + 1}`}>
                  {STATUS_OPCOES.map((opcao) => (
                    <button
                      key={opcao.value}
                      type="button"
                      onClick={() => atualizarStatus(index, opcao.value)}
                      className={`min-h-9 rounded-md border px-2 text-[11px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        presenca.status === opcao.value
                          ? BOTAO_ATIVO[opcao.value]
                          : 'border-border bg-background text-muted-foreground hover:bg-surface'
                      }`}
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <RdoEmptyState
            title="Nenhuma pessoa carregada"
            description="Volte aos dados gerais e selecione uma equipe, ou registre uma pessoa avulsa para este RDO."
            icon={<UsersRound size={18} aria-hidden="true" />}
          >
            <Button type="button" onClick={adicionarReforco}>
              <Plus size={15} aria-hidden="true" />
              Adicionar pessoa na frente
            </Button>
          </RdoEmptyState>
        )}
      </RdoSection>
    </RdoStepShell>
  )
}
