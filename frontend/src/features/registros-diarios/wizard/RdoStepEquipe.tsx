import { Plus, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Avatar, AvatarFallback, Button, Input } from '../../../components/ui'
import type { Equipe, PresencaInput, StatusPresenca } from '../../../types/registroDiario'
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
  presente: 'border-emerald-500 bg-emerald-500/10 text-emerald-600',
  falta: 'border-red-500 bg-red-500/10 text-red-600',
  atestado: 'border-amber-500 bg-amber-500/10 text-amber-600',
}

const CHIP_CLASSE: Record<StatusPresenca, string> = {
  presente: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
  falta: 'border-red-500/30 bg-red-500/10 text-red-600',
  atestado: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
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
    <div aria-label="Equipe / presença">
      <p className="mb-4 text-sm text-muted-foreground">
        Todo mundo já veio marcado como presente — selecione o status de quem faltou. Recebeu reforço hoje? Adicione a
        pessoa na frente.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${CHIP_CLASSE.presente}`}>
          {contagem.presente} presentes
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${CHIP_CLASSE.falta}`}>
          {contagem.falta} faltas
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${CHIP_CLASSE.atestado}`}>
          {contagem.atestado} atestados
        </span>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={marcarTodosPresentes}>
          Marcar todos presentes
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                className="absolute right-2 top-2 text-muted-foreground hover:text-ink"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
            <div className="mb-2 flex items-center gap-2.5 pr-5">
              <Avatar className="h-9 w-9 shrink-0">
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
                    className="h-7 px-1.5 text-sm font-bold"
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
                    className="mt-1 h-6 px-1.5 text-xs"
                    onChange={(event) =>
                      onPresencasChange((current) =>
                        current.map((item, i) => (i === index ? { ...item, funcao: event.target.value } : item)),
                      )
                    }
                  />
                )}
              </div>
            </div>
            <div className="flex gap-1.5">
              {STATUS_OPCOES.map((opcao) => (
                <button
                  key={opcao.value}
                  type="button"
                  onClick={() => atualizarStatus(index, opcao.value)}
                  className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    presenca.status === opcao.value
                      ? BOTAO_ATIVO[opcao.value]
                      : 'border-border text-muted-foreground hover:bg-surface'
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionarReforco}
          className="flex min-h-[7.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus size={18} aria-hidden="true" />
          Adicionar pessoa na frente
        </button>
      </div>
    </div>
  )
}
