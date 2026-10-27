import type { Request } from 'express';
import { HttpError } from './HttpError';

// Validaciones que se repiten en varios controllers

export function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

// Lee el :id de la URL
export function leerId(req: Request): number {
  const id = Number(req.params.id);
  if (!esEnteroPositivo(id)) {
    throw new HttpError(400, 'El id debe ser un número entero positivo');
  }
  return id;
}

// Acepta solo fechas reales en formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-30)
export function validarFecha(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(400, 'La fecha es obligatoria y debe tener formato AAAA-MM-DD');
  }
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new HttpError(400, 'La fecha no es válida');
  }
  return valor;
}

// "HH:MM" en formato 24 horas: 00:00 a 23:59
export function validarHora(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(valor)) {
    throw new HttpError(400, `${campo} debe tener formato HH:MM (por ejemplo "09:00")`);
  }
  return valor;
}