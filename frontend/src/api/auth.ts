import { api } from './http'

// admin: gestiona todo el panel | profesional: solo su agenda y sus días bloqueados
export type Rol = 'admin' | 'profesional'

// Mismas formas que define el backend en auth.service.ts
export interface UsuarioSesion {
  id: number
  nombre: string
  email: string
  rol: Rol
  negocio: { id: number; nombre: string; slug: string }
  profesional: { id: number; nombre: string } | null // si el usuario además atiende
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; usuario: UsuarioSesion }>('/auth/login', { email, password }),
  yo: () => api.get<UsuarioSesion>('/auth/yo'),
  cambiarPassword: (actual: string, nueva: string) =>
    api.post<void>('/auth/cambiar-password', { actual, nueva }),
}
