import type { ReactNode } from 'react'

interface SidebarSectionProps {
  title: string
  children: ReactNode
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}
