import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ConfiguracaoPage } from './pages/ConfiguracaoPage'
import { CustosOciosidadePage } from './pages/CustosOciosidadePage'
import { DashboardPage } from './pages/DashboardPage'
import { HistoricoAprovacoesPage } from './pages/HistoricoAprovacoesPage'
import { LoginPage } from './pages/LoginPage'
import { ProjetosListPage } from './pages/ProjetosListPage'
import { RdoPage } from './pages/RdoPage'
import { RncFormPage } from './pages/RncFormPage'
import { RncListPage } from './pages/RncListPage'
import { RegistroDiarioDetailPage } from './pages/RegistroDiarioDetailPage'
import { RegistrosDiariosListPage } from './pages/RegistrosDiariosListPage'
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute'
import { Toaster } from './components/ui'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projetos" element={<ProjetosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios" element={<RegistrosDiariosListPage />} />
              <Route path="/projetos/:projetoId/registros-diarios/novo" element={<RdoPage />} />
              <Route
                path="/projetos/:projetoId/registros-diarios/:registroId"
                element={<RegistroDiarioDetailPage />}
              />
              <Route path="/projetos/:projetoId/configuracoes" element={<ConfiguracaoPage />} />
              <Route path="/projetos/:projetoId/rncs" element={<RncListPage />} />
              <Route path="/projetos/:projetoId/rncs/novo" element={<RncFormPage />} />
              <Route path="/projetos/:projetoId/rncs/:rncId" element={<RncFormPage />} />
              <Route path="/projetos/:projetoId/custos-ociosidade" element={<CustosOciosidadePage />} />
              <Route
                path="/projetos/:projetoId/historico-aprovacoes"
                element={<HistoricoAprovacoesPage />}
              />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </AuthProvider>
  )
}

export default App
