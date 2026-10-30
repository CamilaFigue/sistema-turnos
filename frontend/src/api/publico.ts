import { api } from './http'
import type { DatosTurno } from './turnos'

// Mismas formas que devuelve el backend en publico.controller.ts
export interface ServicioPublico {
  id: number
  nombre: string
  descripcion: string | null
  duracion_minutos: number
  precio: number
  profesionales: { id: number; nombre: string }[]
}

export interface NegocioPublico {
  nombre: string
  telefono: string | null
  direccion: string | null
  servicios: ServicioPublico[]
}

export interface TurnoReservado {
  fecha: string
  hora_inicio: string
  hora_fin: string
  profesional: string
  servicio: string
}

// Rutas sin login: el negocio se identifica por el slug de la URL
export const publicoApi = {
  negocio: (slug: string) => api.get<NegocioPublico>(`/publico/${slug}`),
  disponibilidad: (slug: string, profesionalId: number, servicioId: number, fecha: string) =>
    api.get<string[]>(
      `/publico/${slug}/disponibilidad?profesional_id=${profesionalId}&servicio_id=${servicioId}&fecha=${fecha}`,
    ),
  reservar: (slug: string, datos: DatosTurno) =>
    api.post<TurnoReservado>(`/publico/${slug}/turnos`, datos),
}
