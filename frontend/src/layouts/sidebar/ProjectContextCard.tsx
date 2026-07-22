import { ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Input } from '../../components/ui'
import { useBuscaProjetos } from '../../features/projetos/useBuscaProjetos'
import { useProjeto } from '../../features/projetos/projetosApi'
import { STATUS_BADGE_CLASS, STATUS_LABEL } from '../../features/projetos/statusBadge'
import { formatData, formatExecucao } from '../../lib/format'

interface ProjectContextCardProps {
  projetoId: string
}

export function ProjectContextCard({ projetoId }: ProjectContextCardProps) {
  const projeto = useProjeto(projetoId)
  const [aberto, setAberto] = useState(false)
  const { termo, setTermo, resultados } = useBuscaProjetos()
  const painelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(event.target as Node)) {
        setAberto(false)
        setTermo('')
      }
    }
    document.addEventListener('mousedown', fecharAoClicarFora)
    return () => document.removeEventListener('mousedown', fecharAoClicarFora)
  }, [setTermo])

  if (projeto.isLoading || !projeto.data) {
    return (
      <div className="mx-3 mb-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">Carregando projeto…</p>
      </div>
    )
  }

  const dados = projeto.data

  return (
    <div ref={painelRef} className="relative mx-3 mb-2">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Trocar de projeto"
        className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-border p-3 text-left hover:bg-surface"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Projeto Atual
          </p>
          <ChevronsUpDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        </div>
        <p className="truncate font-display text-sm font-bold text-ink">{dados.nome}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Badge className={STATUS_BADGE_CLASS[dados.status]}>{STATUS_LABEL[dados.status]}</Badge>
          <span>{formatExecucao(dados.execucao_percentual)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Último RDO: {formatData(dados.ultimo_rdo_data)}</p>
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-border bg-background p-2 shadow-md">
          <div className="relative mb-2">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={termo}
              onChange={(event) => setTermo(event.target.value)}
              placeholder="Buscar projeto…"
              aria-label="Buscar projeto para trocar"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <ul aria-label="Resultados da busca de projetos">
            {termo && resultados.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum projeto encontrado.</li>
            )}
            {resultados.map((resultado) => (
              <li key={resultado.id}>
                <Link
                  to={`/projetos/${resultado.id}/registros-diarios`}
                  className="block rounded-sm px-2 py-1.5 text-sm hover:bg-surface"
                  onClick={() => {
                    setAberto(false)
                    setTermo('')
                  }}
                >
                  {resultado.nome}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/projetos"
            className="mt-1 block rounded-sm px-2 py-1.5 text-sm font-medium text-primary hover:underline"
            onClick={() => setAberto(false)}
          >
            Ver todos os projetos →
          </Link>
        </div>
      )}
    </div>
  )
}
