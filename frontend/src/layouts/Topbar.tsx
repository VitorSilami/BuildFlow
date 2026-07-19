import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { useTheme } from '../features/theme/ThemeContext'
import { Button } from '../components/ui'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet'
import { SidebarNav } from './Sidebar'

export function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir navegação"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-ink">
          {user?.empresa_nome} — {user?.nome} ({user?.perfil})
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Alternar tema claro/escuro" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden="true" />
          Sair
        </Button>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="h-16 justify-center border-b border-border px-4">
            <SheetTitle className="text-left font-display text-lg font-bold tracking-tight text-ink">
              Build<span className="text-signal">Flow</span>
            </SheetTitle>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Field OS
            </span>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>
    </header>
  )
}
