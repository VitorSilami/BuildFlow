import type { ReactNode } from 'react'
import type { Location } from 'react-router-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

const navItemClass = (isActive: boolean) =>
  cn(
    'group relative flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring',
    isActive
      ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_var(--color-primary)]'
      : 'text-muted-foreground hover:bg-surface hover:text-ink',
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
            ativo ? 'border-primary/25 bg-primary text-primary-foreground' : 'border-border bg-background',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">{children}</span>
        {ativo && <span aria-hidden="true" className="ml-auto h-5 w-1 rounded-full bg-primary" />}
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
                ? 'border-primary/25 bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground group-hover:border-primary/25 group-hover:text-primary',
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 truncate">{children}</span>
          {ativo && <span aria-hidden="true" className="ml-auto h-5 w-1 rounded-full bg-primary" />}
        </>
      )}
    </NavLink>
  )
}
