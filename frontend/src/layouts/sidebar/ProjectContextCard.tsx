import { ChevronDown, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '../../components/ui'
import { useBuscaProjetos } from '../../features/projetos/useBuscaProjetos'
import { useProjeto } from '../../features/projetos/projetosApi'

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
      <div className="border-b border-border px-3 py-3">
        <p className="text-xs text-muted-foreground">Carregando projeto…</p>
      </div>
    )
  }

  const dados = projeto.data

  return (
    <div ref={painelRef} className="relative py-2">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-label="Trocar de projeto"
        className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-left hover:bg-surface"
      >
        <span className="truncate font-display text-sm font-bold text-ink">{dados.nome}</span>
        <ChevronDown size={13} aria-hidden="true" className="ml-auto shrink-0 text-muted-foreground" />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-10 mt-1 w-[calc(100%-1.5rem)] rounded-md border border-border bg-background p-2 shadow-md ml-3">
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
