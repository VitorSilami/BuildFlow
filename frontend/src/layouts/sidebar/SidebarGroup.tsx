import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface SidebarGroupProps {
  title: string
  children: ReactNode
}

export function SidebarGroup({ title, children }: SidebarGroupProps) {
  const [expandido, setExpandido] = useState(true)

  return (
    <section className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpandido((atual) => !atual)}
        aria-expanded={expandido}
        className="flex min-h-8 items-center justify-between rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{title}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={cn('shrink-0 transition-transform', expandido ? '' : '-rotate-90')}
        />
      </button>
      {expandido && <div className="flex flex-col gap-1">{children}</div>}
    </section>
  )
}
