import type { Request, Response } from 'express';
import * as horarioService from '../services/horarios.service';
import type { DatosHorario } from '../services/horarios.service';
import { HttpError } from '../utils/HttpError';
import { negocioDe } from '../middlewares/autenticacion';

// "HH:MM" en formato 24 horas: 00:00 a 23:59
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function leerId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'El id debe ser un número entero positivo');
  }
  return id;
}

// Revisa una franja y devuelve sus datos limpios, o lanza un error 400
function validarHorario(item: unknown, posicion: number): DatosHorario {
  const { dia_semana, hora_inicio, hora_fin } = (item ?? {}) as Record<string, unknown>;
  const prefijo = `Franja ${posicion + 1}:`;

  if (typeof dia_semana !== 'number' || !Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    throw new HttpError(400, `${prefijo} dia_semana debe ser un número de 0 (domingo) a 6 (sábado)`);
  }
  if (typeof hora_inicio !== 'string' || !FORMATO_HORA.test(hora_inicio)) {
    throw new HttpError(400, `${prefijo} hora_inicio debe tener formato HH:MM (por ejemplo "09:00")`);
  }
  if (typeof hora_fin !== 'string' || !FORMATO_HORA.test(hora_fin)) {
    throw new HttpError(400, `${prefijo} hora_fin debe tener formato HH:MM (por ejemplo "13:00")`);
  }
  if (hora_fin <= hora_inicio) {
    throw new HttpError(400, `${prefijo} hora_fin debe ser posterior a hora_inicio`);
  }

  return { dia_semana, hora_inicio, hora_fin };
}

function validarHorarios(body: unknown): DatosHorario[] {
  const { horarios } = (body ?? {}) as Record<string, unknown>;

  if (!Array.isArray(horarios)) {
    throw new HttpError(400, 'horarios debe ser una lista de franjas');
  }
  return horarios.map(validarHorario);
}

export async function listar(req: Request, res: Response) {
  const horarios = await horarioService.listar(negocioDe(req), leerId(req));
  if (!horarios) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(horarios);
}

export async function reemplazar(req: Request, res: Response) {
  const horarios = await horarioService.reemplazar(negocioDe(req), leerId(req), validarHorarios(req.body));
  if (!horarios) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(horarios);
}