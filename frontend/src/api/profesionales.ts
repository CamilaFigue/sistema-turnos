import { api } from './http'

// Mismas formas que define el backend en profesionales.service.ts
export interface ServicioAsignado {
  id: number
  nombre: string
}

export interface Profesional {
  id: number
  nombre: string
  usuario_id: number | null
  activo: boolean
  creado_en: string
  servicios: ServicioAsignado[]
}

export interface DatosProfesional {
  nombre: string
  usuario_id: number | null
}

export const profesionalesApi = {
  listar: () => api.get<Profesional[]>('/profesionales'),
  crear: (datos: DatosProfesional) => api.post<Profesional>('/profesionales', datos),
  actualizar: (id: number, datos: DatosProfesional) =>
    api.put<Profesional>(`/profesionales/${id}`, datos),
  desactivar: (id: number) => api.delete<void>(`/profesionales/${id}`),
  activar: (id: number) => api.patch<Profesional>(`/profesionales/${id}/activar`),
  asignarServicios: (id: number, servicioIds: number[]) =>
    api.put<Profesional>(`/profesionales/${id}/servicios`, { servicio_ids: servicioIds }),
  disponibilidad: (id: number, fecha: string, servicioId: number) =>
    api.get<string[]>(
      `/profesionales/${id}/disponibilidad?fecha=${fecha}&servicio_id=${servicioId}`,
    ),
}
