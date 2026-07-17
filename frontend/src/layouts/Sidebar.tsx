import { FileText, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import { useTheme } from '../features/theme/ThemeContext'

export function Sidebar() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="sidebar-wrapper active">
      <div className="sidebar-header position-relative">
        <div className="d-flex justify-content-between align-items-center">
          <div className="logo">
            <span className="fw-bold fs-4">BuildFlow</span>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="toggle-dark"
              checked={theme === 'dark'}
              onChange={toggleTheme}
              aria-label="Alternar tema claro/escuro"
            />
          </div>
        </div>
      </div>
      <div className="sidebar-menu">
        <ul className="menu">
          <li className="sidebar-title">Navegação</li>
          <li className="sidebar-item">
            <NavLink to="/projetos" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <LayoutGrid size={18} aria-hidden="true" />
              <span>Projetos</span>
            </NavLink>
          </li>
          {projetoId && (
            <>
              <li className="sidebar-item">
                <NavLink
                  to={`/projetos/${projetoId}/registros-diarios`}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <FileText size={18} aria-hidden="true" />
                  <span>Registros diários</span>
                </NavLink>
              </li>
              <li className="sidebar-item">
                <NavLink
                  to={`/projetos/${projetoId}/configuracoes`}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                >
                  <Settings size={18} aria-hidden="true" />
                  <span>Configurações</span>
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  )
}
