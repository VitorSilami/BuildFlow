import { FileText, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <NavLink to="/dashboard" className={navItemClass}>
        <LayoutDashboard size={18} aria-hidden="true" />
        Dashboard
      </NavLink>
      <p className="px-3 pb-2 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Operação
      </p>
      <NavLink to="/projetos" className={navItemClass}>
        <LayoutGrid size={18} aria-hidden="true" />
        Projetos
      </NavLink>
      {projetoId && (
        <>
          <NavLink to={`/projetos/${projetoId}/registros-diarios`} className={navItemClass}>
            <FileText size={18} aria-hidden="true" />
            Registros diários
          </NavLink>
          <NavLink to={`/projetos/${projetoId}/configuracoes`} className={navItemClass}>
            <Settings size={18} aria-hidden="true" />
            Configurações
          </NavLink>
        </>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
      <div className="flex h-16 flex-col justify-center border-b border-border px-4">
        <span className="font-display text-lg font-bold tracking-tight text-ink">
          Build<span className="text-signal">Flow</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Field OS
        </span>
      </div>
      <SidebarNav />
    </aside>
  )
}
