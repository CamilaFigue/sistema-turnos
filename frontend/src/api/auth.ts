import { api } from './http'

// Mismas formas que define el backend en auth.service.ts
export interface UsuarioSesion {
  id: number
  nombre: string
  email: string
  rol: 'dueno' | 'empleado'
  negocio: { id: number; nombre: string }
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; usuario: UsuarioSesion }>('/auth/login', { email, password }),
  yo: () => api.get<UsuarioSesion>('/auth/yo'),
}
