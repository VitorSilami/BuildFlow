import { LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { useTheme } from '../features/theme/ThemeContext'
import { useProjetos } from '../features/projetos/projetosApi'
import { Button, Input } from '../components/ui'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { SidebarNav } from './Sidebar'

const MAX_RESULTADOS_BUSCA = 5

export function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const buscaRef = useRef<HTMLDivElement>(null)
  const projetos = useProjetos()

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(event.target as Node)) {
        setTermoBusca('')
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  const resultadosBusca = termoBusca
    ? (projetos.data?.results ?? [])
        .filter((projeto) => projeto.nome.toLowerCase().includes(termoBusca.toLowerCase()))
        .slice(0, MAX_RESULTADOS_BUSCA)
    : []

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir navegação"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-ink">
          {user?.empresa_nome} — {user?.nome} ({user?.perfil})
        </span>
      </div>

      <div ref={buscaRef} className="relative hidden max-w-xs flex-1 md:block">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={termoBusca}
          onChange={(event) => setTermoBusca(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setTermoBusca('')
          }}
          placeholder="Buscar projeto…"
          aria-label="Buscar projeto"
          className="pl-9"
        />
        {termoBusca && (
          <ul
            aria-label="Resultados da busca"
            className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background py-1 shadow-md"
          >
            {resultadosBusca.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum projeto encontrado.</li>
            ) : (
              resultadosBusca.map((projeto) => (
                <li key={projeto.id}>
                  <Link
                    to={`/projetos/${projeto.id}/registros-diarios`}
                    className="block px-3 py-2 text-sm hover:bg-surface"
                    onClick={() => setTermoBusca('')}
                  >
                    {projeto.nome}
                  </Link>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden="true" />
          Sair
        </Button>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Field OS
            </span>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </header>
  )
}
