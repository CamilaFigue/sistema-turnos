import { api } from './http'
import type { DatosTurno, EstadoTurno } from './turnos'

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
  codigo_cancelacion: string // va en el link para cancelar
}

// Lo que ve el cliente desde el link de cancelación
export interface TurnoPublico {
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: EstadoTurno
  profesional: string
  servicio: string
  se_puede_cancelar: boolean
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
  verTurno: (slug: string, codigo: string) =>
    api.get<TurnoPublico>(`/publico/${slug}/turnos/${codigo}`),
  cancelarTurno: (slug: string, codigo: string) =>
    api.post<TurnoPublico>(`/publico/${slug}/turnos/${codigo}/cancelar`),
}

// Link completo que el cliente guarda para cancelar su turno
export function linkCancelacion(slug: string, codigo: string): string {
  return `${window.location.origin}/reservar/${slug}/cancelar/${codigo}`
}
