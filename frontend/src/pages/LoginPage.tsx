import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { Alert, Spinner } from '../components/ui'
import { AuthLayout } from '../layouts/AuthLayout'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Não foi possível carregar o login do Google.'))
    document.head.appendChild(script)
  })
}

export function LoginPage() {
  const { loginWithGoogle, loginError } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'authenticating' | 'error'>('loading')
  const [scriptError, setScriptError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setStatus('authenticating')
            const success = await loginWithGoogle(response.credential)
            if (success) {
              navigate('/projetos', { replace: true })
            } else {
              setStatus('error')
            }
          },
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
        })
        setStatus('ready')
      })
      .catch((error: Error) => {
        setScriptError(error.message)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [loginWithGoogle, navigate])

  return (
    <AuthLayout>
      <h1 className="auth-title fw-bold">BuildFlow</h1>
      <p className="auth-subtitle mb-4 text-muted">
        Gestão diária de obras — acesse com a conta Google da sua empresa.
      </p>

      {status === 'loading' && <Spinner label="Carregando…" />}

      <div ref={buttonRef} aria-live="polite" />

      {status === 'authenticating' && <Spinner label="Entrando…" />}

      {(loginError || scriptError) && (
        <div className="mt-3">
          <Alert>{loginError ?? scriptError}</Alert>
        </div>
      )}
    </AuthLayout>
  )
}
