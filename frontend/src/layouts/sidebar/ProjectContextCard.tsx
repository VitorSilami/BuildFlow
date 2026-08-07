import { ChevronDown, FolderKanban, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '../../components/ui'
import { useBuscaProjetos } from '../../features/projetos/useBuscaProjetos'
import { useProjeto } from '../../features/projetos/projetosApi'
import { cn } from '../../lib/utils'

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
      <div className="px-2 py-2">
        <p className="h-12 animate-pulse rounded-md border border-border bg-surface" aria-label="Carregando projeto">
          <span className="sr-only">Carregando projeto…</span>
        </p>
      </div>
    )
  }

  const dados = projeto.data

  return (
    <div ref={painelRef} className="relative px-2 py-2">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Trocar de projeto"
        className={cn(
          'group flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-brand-cyan/45 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          aberto && 'border-brand-cyan/60 bg-info/5',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-info/10 text-brand-blue">
          <FolderKanban size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Projeto
          </span>
          <span className="block truncate font-display text-sm font-bold text-ink">{dados.nome}</span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('ml-auto shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')}
        />
      </button>

      {aberto && (
        <div className="absolute left-2 right-2 top-full z-20 mt-1 rounded-md border border-border bg-popover p-2 shadow-xl">
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
              placeholder="Buscar projeto..."
              aria-label="Buscar projeto para trocar"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <ul aria-label="Resultados da busca de projetos" className="max-h-56 overflow-y-auto">
            {termo && resultados.length === 0 && (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">Nenhum projeto encontrado.</li>
            )}
            {resultados.map((resultado) => (
              <li key={resultado.id}>
                <Link
                  to={`/projetos/${resultado.id}/registros-diarios`}
                  className="block truncate rounded-md px-2 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface"
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
            className="mt-1 block rounded-md border-t border-border px-2 py-2 text-sm font-semibold text-brand-blue transition-colors hover:bg-info/5"
            onClick={() => setAberto(false)}
          >
            Ver todos os projetos →
          </Link>
        </div>
      )}
    </div>
  )
}
