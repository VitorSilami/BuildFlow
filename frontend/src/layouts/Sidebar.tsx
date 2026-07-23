import { AlertTriangle, DollarSign, FileText, History, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ProjectContextCard } from './sidebar/ProjectContextCard'
import { SidebarGroup } from './sidebar/SidebarGroup'
import { SidebarNavItem } from './sidebar/SidebarNavItem'
import { SidebarSection } from './sidebar/SidebarSection'

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { user } = useAuth()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <SidebarSection title="Empresa">
        <SidebarNavItem to="/dashboard" icon={<LayoutDashboard size={18} aria-hidden="true" />}>
          Dashboard
        </SidebarNavItem>
        <SidebarNavItem to="/projetos" icon={<LayoutGrid size={18} aria-hidden="true" />}>
          Projetos
        </SidebarNavItem>
      </SidebarSection>

      {projetoId && (
        <>
          <ProjectContextCard projetoId={projetoId} />

          <div className="relative ml-4 flex flex-col gap-1 border-l-2 border-dashed border-primary/25 pl-3">
            <SidebarGroup title="Operação">
              <SidebarNavItem
                to={`/projetos/${projetoId}/registros-diarios`}
                icon={<FileText size={18} aria-hidden="true" />}
              >
                Registros diários
              </SidebarNavItem>
              <SidebarNavItem
                to={`/projetos/${projetoId}/historico-aprovacoes`}
                icon={<History size={18} aria-hidden="true" />}
              >
                Histórico & Aprovações
              </SidebarNavItem>
            </SidebarGroup>

            {user?.perfil === 'gerente' && (
              <SidebarGroup title="Gestão">
                <SidebarNavItem
                  to={`/projetos/${projetoId}/rncs`}
                  icon={<AlertTriangle size={18} aria-hidden="true" />}
                >
                  RNCs
                </SidebarNavItem>
                <SidebarNavItem
                  to={`/projetos/${projetoId}/custos-ociosidade`}
                  icon={<DollarSign size={18} aria-hidden="true" />}
                >
                  Custos & Ociosidade
                </SidebarNavItem>
              </SidebarGroup>
            )}

            <SidebarGroup title="Administração">
              <SidebarNavItem
                to={`/projetos/${projetoId}/configuracoes`}
                icon={<Settings size={18} aria-hidden="true" />}
              >
                Configurações
              </SidebarNavItem>
            </SidebarGroup>
          </div>
        </>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-background lg:flex lg:flex-col">
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
