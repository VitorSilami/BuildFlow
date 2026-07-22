import type { ReactNode } from 'react'

interface SidebarSectionProps {
  title: string
  children: ReactNode
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  )
}
