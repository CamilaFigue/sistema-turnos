import { api } from './http'

// Mismas formas que define el backend en bloqueos.service.ts
export interface Bloqueo {
  id: number
  profesional: { id: number; nombre: string }
  desde: string // "2026-12-20"
  hasta: string // "2027-01-05"
  motivo: string | null
}

export interface DatosBloqueo {
  profesional_id: number | null // un profesional no lo manda: el backend usa el suyo
  desde: string
  hasta: string
  motivo: string | null
}

// Turno que se canceló al crear el bloqueo: para avisarle al cliente
export interface TurnoAfectado {
  id: number
  fecha: string
  hora_inicio: string
  servicio: string
  cliente: { nombre: string; telefono: string }
}

export const bloqueosApi = {
  listar: () => api.get<Bloqueo[]>('/bloqueos'),
  crear: (datos: DatosBloqueo) =>
    api.post<{ bloqueo: Bloqueo; turnos_cancelados: TurnoAfectado[] }>('/bloqueos', datos),
  eliminar: (id: number) => api.delete<void>(`/bloqueos/${id}`),
}
