import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiClient } from '../../services/apiClient'
import type { AllauthResponse, AllauthSessionData, UsuarioAutenticado } from '../../types/auth'

const SESSION_PATH = '/_allauth/browser/v1/auth/session'
const PROVIDER_TOKEN_PATH = '/_allauth/browser/v1/auth/provider/token'

interface AuthContextValue {
  user: UsuarioAutenticado | null
  isLoading: boolean
  loginError: string | null
  loginWithGoogle: (idToken: string) => Promise<boolean>
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioAutenticado | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.raw.get<AllauthResponse<AllauthSessionData>>(SESSION_PATH)
      setUser(response.data.user ?? null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setLoginError(null)
    const response = await apiClient.raw.post<AllauthResponse<AllauthSessionData>>(PROVIDER_TOKEN_PATH, {
      provider: 'google',
      process: 'login',
      token: { id_token: idToken, client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '' },
    })

    if (response.status === 200 && response.data.user) {
      setUser(response.data.user)
      return true
    }

    // FR-008: mensagem generica, sem detalhar o motivo exato.
    setLoginError('Acesso não autorizado. Verifique se sua conta está cadastrada e ativa.')
    return false
  }, [])

  const logout = useCallback(async () => {
    await apiClient.raw.delete(SESSION_PATH)
    setUser(null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, loginError, loginWithGoogle, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
