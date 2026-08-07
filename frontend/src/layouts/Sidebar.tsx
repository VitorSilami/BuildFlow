import {
  AlertTriangle,
  DollarSign,
  FileText,
  History,
  LayoutDashboard,
  LayoutGrid,
  ListTree,
  Receipt,
  Settings,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { SidebarGroup } from './sidebar/SidebarGroup'
import { SidebarNavItem } from './sidebar/SidebarNavItem'
import { SidebarSection } from './sidebar/SidebarSection'

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { user } = useAuth()

  return (
    <nav aria-label="Navegação principal" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      <SidebarSection title="Empresa">
        <SidebarNavItem to="/dashboard" end icon={<LayoutDashboard size={18} aria-hidden="true" />}>
          Dashboard
        </SidebarNavItem>
        <SidebarNavItem to="/projetos" end icon={<LayoutGrid size={18} aria-hidden="true" />}>
          Projetos
        </SidebarNavItem>
      </SidebarSection>

      {projetoId && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/70 p-2 shadow-sm">
          <SidebarGroup title="Planejamento">
            <SidebarNavItem
              to={`/projetos/${projetoId}/planejamento/eap`}
              icon={<ListTree size={18} aria-hidden="true" />}
              isActive={(location) =>
                location.pathname === `/projetos/${projetoId}/planejamento/eap`
              }
            >
              EAP
            </SidebarNavItem>
          </SidebarGroup>

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
            <SidebarNavItem
              to={`/projetos/${projetoId}/medicoes`}
              icon={<Receipt size={18} aria-hidden="true" />}
            >
              Medições
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
              isActive={(location) =>
                location.pathname === `/projetos/${projetoId}/configuracoes`
              }
            >
              Configurações
            </SidebarNavItem>
          </SidebarGroup>
        </div>
      )}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 border-r border-border bg-surface/55 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-border bg-background/75 px-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <LayoutGrid size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-5 tracking-tight text-ink">
            Build<span className="text-signal">Flow</span>
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Field OS
          </span>
        </span>
      </div>
      <SidebarNav />
    </aside>
  )
}
