export type Perfil = 'gerente' | 'auxiliar_administrativo'

export interface UsuarioAutenticado {
  id: string
  email: string
  nome: string
  perfil: Perfil
  empresa: string
  empresa_nome: string
}

export interface AllauthSessionData {
  user?: UsuarioAutenticado
}

export interface AllauthResponse<T> {
  status: number
  data: T
  meta?: { is_authenticated: boolean }
}
