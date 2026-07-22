import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface SidebarGroupProps {
  title: string
  children: ReactNode
}

export function SidebarGroup({ title, children }: SidebarGroupProps) {
  const [expandido, setExpandido] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpandido((atual) => !atual)}
        aria-expanded={expandido}
        className="flex items-center justify-between px-3 pb-1 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-ink"
      >
        {title}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${expandido ? '' : '-rotate-90'}`}
        />
      </button>
      {expandido && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  )
}
