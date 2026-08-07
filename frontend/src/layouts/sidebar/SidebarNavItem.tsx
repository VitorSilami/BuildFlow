import type { ReactNode } from 'react'
import type { Location } from 'react-router-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navItemClass = (isActive: boolean) =>
  cn(
    'group relative flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-white/10 text-white ring-1 ring-brand-cyan/35'
      : 'text-white/70 hover:bg-white/10 hover:text-white',
  )

interface SidebarNavItemProps {
  to: string
  icon: ReactNode
  children: ReactNode
  isActive?: (location: Location) => boolean
  end?: boolean
}

export function SidebarNavItem({ to, icon, children, isActive, end }: SidebarNavItemProps) {
  const location = useLocation()

  if (isActive) {
    const ativo = isActive(location)
    return (
      <NavLink to={to} end={end} className={navItemClass(ativo)}>
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md border transition-colors',
            ativo ? 'border-brand-cyan/30 bg-brand-cyan text-brand-navy' : 'border-white/15 bg-white/5 text-white/70',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">{children}</span>
        {ativo && <span aria-hidden="true" className="ml-auto h-5 w-1 rounded-full bg-brand-cyan" />}
      </NavLink>
    )
  }

  return (
    <NavLink to={to} end={end} className={({ isActive: ativo }) => navItemClass(ativo)}>
      {({ isActive: ativo }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-md border transition-colors',
              ativo
                ? 'border-brand-cyan/30 bg-brand-cyan text-brand-navy'
                : 'border-white/15 bg-white/5 text-white/70 group-hover:border-brand-cyan/35 group-hover:text-brand-cyan',
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 truncate">{children}</span>
          {ativo && <span aria-hidden="true" className="ml-auto h-5 w-1 rounded-full bg-brand-cyan" />}
        </>
      )}
    </NavLink>
  )
}
