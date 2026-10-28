import { api } from './http'

// Mismas formas que define el backend en horarios.service.ts
export interface Horario {
  id: number
  dia_semana: number // 0 = domingo ... 6 = sábado
  hora_inicio: string // "09:00"
  hora_fin: string // "13:00"
}

export interface DatosHorario {
  dia_semana: number
  hora_inicio: string
  hora_fin: string
}

export const horariosApi = {
  listar: (profesionalId: number) => api.get<Horario[]>(`/profesionales/${profesionalId}/horarios`),
  // Reemplaza la semana completa: se manda siempre la lista entera de franjas
  reemplazar: (profesionalId: number, horarios: DatosHorario[]) =>
    api.put<Horario[]>(`/profesionales/${profesionalId}/horarios`, { horarios }),
}
