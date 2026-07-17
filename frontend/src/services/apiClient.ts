const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = readCookie('csrftoken')
    if (csrfToken) headers.set('X-CSRFToken', csrfToken)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })

  // DRF responde 403 (nao 401) para requisicoes anonimas nos nossos endpoints
  // /api/v1/* (SessionAuthentication nao oferece desafio WWW-Authenticate) —
  // tratamos os dois como "sessao invalida" pro AuthContext.
  if (response.status === 401 || response.status === 403) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    throw new ApiError(response.status, 'Autenticação necessária.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(response.status, body?.detail ?? 'Ocorreu um erro inesperado.')
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

// Variante que nunca lança em 401/4xx — usada para os endpoints do allauth
// headless, cujo corpo de resposta (data.user, data.flows) é significativo
// mesmo quando o status não é 2xx (ex.: "não autenticado" vs "login recusado").
async function requestRaw<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = readCookie('csrftoken')
    if (csrfToken) headers.set('X-CSRFToken', csrfToken)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })

  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  raw: {
    get: <T>(path: string) => requestRaw<T>(path),
    post: <T>(path: string, data?: unknown) =>
      requestRaw<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
    delete: <T>(path: string) => requestRaw<T>(path, { method: 'DELETE' }),
  },
}
