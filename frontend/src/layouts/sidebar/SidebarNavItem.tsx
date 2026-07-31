import type { ReactNode } from 'react'
import type { Location } from 'react-router-dom'
import { NavLink, useLocation } from 'react-router-dom'

const navItemClass = (isActive: boolean) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

interface SidebarNavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
  isActive?: (location: Location) => boolean
}

export function SidebarNavItem({ to, icon, children, isActive }: SidebarNavItemProps) {
  const location = useLocation()

  if (isActive) {
    const ativo = isActive(location)
    return (
      <NavLink to={to} className={navItemClass(ativo)}>
        {icon}
        {children}
      </NavLink>
    )
  }

  return (
    <NavLink to={to} className={({ isActive: ativo }) => navItemClass(ativo)}>
      {icon}
      {children}
    </NavLink>
  )
}
