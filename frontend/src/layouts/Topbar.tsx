import { LogOut } from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'

export function Topbar() {
  const { user, logout } = useAuth()

  return (
    <header className="mb-3 d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
      <span className="fw-semibold">
        {user?.empresa_nome} — {user?.nome} ({user?.perfil})
      </span>
      <button type="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" onClick={() => void logout()}>
        <LogOut size={16} aria-hidden="true" />
        Sair
      </button>
    </header>
  )
}
