import { api } from './http'

// Mismas formas que define el backend en turnos.service.ts
export type EstadoTurno = 'pendiente' | 'confirmado' | 'cancelado' | 'completado'

export interface Turno {
  id: number
  fecha: string // "2026-11-02"
  hora_inicio: string // "10:00"
  hora_fin: string // "10:30"
  estado: EstadoTurno
  notas: string | null
  creado_en: string
  profesional: { id: number; nombre: string }
  servicio: { id: number; nombre: string; duracion_minutos: number }
  cliente: { id: number; nombre: string; telefono: string; email: string | null }
}

export interface DatosTurno {
  profesional_id: number
  servicio_id: number
  fecha: string
  hora: string
  notas: string | null
  cliente: { nombre: string; telefono: string; email: string | null }
}

export const turnosApi = {
  // Agenda de un día; si no se pasa profesional, trae la de todos
  listar: (fecha: string, profesionalId: number | null) => {
    const filtro = profesionalId === null ? '' : `&profesional_id=${profesionalId}`
    return api.get<Turno[]>(`/turnos?fecha=${fecha}${filtro}`)
  },
  crear: (datos: DatosTurno) => api.post<Turno>('/turnos', datos),
  cambiarEstado: (id: number, estado: EstadoTurno) =>
    api.patch<Turno>(`/turnos/${id}/estado`, { estado }),
}
