import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

interface SidebarNavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
}

export function SidebarNavItem({ to, icon, children }: SidebarNavItemProps) {
  return (
    <NavLink to={to} className={navItemClass}>
      {icon}
      {children}
    </NavLink>
  )
}
