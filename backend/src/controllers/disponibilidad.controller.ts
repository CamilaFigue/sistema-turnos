import type { Request, Response } from 'express';
import * as disponibilidadService from '../services/disponibilidad.service';
import { HttpError } from '../utils/HttpError';

// TEMPORAL: cuando hagamos el login, el negocio va a salir del token del usuario
const NEGOCIO_ID = 1;

function leerId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'El id debe ser un número entero positivo');
  }
  return id;
}

// Acepta solo fechas reales en formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-30)
function validarFecha(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(400, 'La fecha es obligatoria y debe tener formato AAAA-MM-DD');
  }
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new HttpError(400, 'La fecha no es válida');
  }
  return valor;
}

function validarServicioId(valor: unknown): number {
  const id = Number(valor);
  if (typeof valor !== 'string' || !Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'servicio_id es obligatorio y debe ser un número entero positivo');
  }
  return id;
}

// GET /api/profesionales/:id/disponibilidad?fecha=2026-10-26&servicio_id=1
export async function obtener(req: Request, res: Response) {
  const horarios = await disponibilidadService.obtener(
    NEGOCIO_ID,
    leerId(req),
    validarFecha(req.query.fecha),
    validarServicioId(req.query.servicio_id),
  );
  if (!horarios) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(horarios);
}