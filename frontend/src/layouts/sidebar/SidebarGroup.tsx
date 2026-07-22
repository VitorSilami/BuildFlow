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
        className="flex items-center justify-between px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 hover:text-muted-foreground"
      >
        {title}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`transition-transform ${expandido ? '' : '-rotate-90'}`}
        />
      </button>
      {expandido && <div className="flex flex-col gap-1">{children}</div>}
    </div>
  )
}
