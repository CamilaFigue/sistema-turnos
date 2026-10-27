import { api } from './http'

// Mismas formas que define el backend en servicios.service.ts
export interface Servicio {
  id: number
  nombre: string
  descripcion: string | null
  duracion_minutos: number
  precio: number
  activo: boolean
  creado_en: string
}

export interface DatosServicio {
  nombre: string
  descripcion: string | null
  duracion_minutos: number
  precio: number
}

export const serviciosApi = {
  listar: () => api.get<Servicio[]>('/servicios'),
  crear: (datos: DatosServicio) => api.post<Servicio>('/servicios', datos),
  actualizar: (id: number, datos: DatosServicio) => api.put<Servicio>(`/servicios/${id}`, datos),
  desactivar: (id: number) => api.delete<void>(`/servicios/${id}`),
  activar: (id: number) => api.patch<Servicio>(`/servicios/${id}/activar`),
}