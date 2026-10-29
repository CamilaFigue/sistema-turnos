import type { Request, Response } from 'express';
import * as servicioService from '../services/servicios.service';
import type { DatosServicio } from '../services/servicios.service';
import { HttpError } from '../utils/HttpError';
import { negocioDe } from '../middlewares/autenticacion';

function leerId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'El id debe ser un número entero positivo');
  }
  return id;
}

// Revisa el body y devuelve los datos limpios, o lanza un error 400
function validarDatos(body: unknown): DatosServicio {
  const { nombre, descripcion, duracion_minutos, precio } = (body ?? {}) as Record<string, unknown>;

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new HttpError(400, 'El nombre es obligatorio');
  }

  let descripcionLimpia: string | null = null;
  if (descripcion !== undefined && descripcion !== null) {
    if (typeof descripcion !== 'string') {
      throw new HttpError(400, 'La descripción debe ser texto');
    }
    descripcionLimpia = descripcion.trim() || null;
  }

  if (typeof duracion_minutos !== 'number' || !Number.isInteger(duracion_minutos) || duracion_minutos <= 0) {
    throw new HttpError(400, 'La duración debe ser un número entero de minutos mayor a 0');
  }

  if (typeof precio !== 'number' || precio < 0) {
    throw new HttpError(400, 'El precio debe ser un número mayor o igual a 0');
  }

  return { nombre: nombre.trim(), descripcion: descripcionLimpia, duracion_minutos, precio };
}

export async function listar(req: Request, res: Response) {
  const servicios = await servicioService.listar(negocioDe(req));
  res.json(servicios);
}

export async function obtener(req: Request, res: Response) {
  const servicio = await servicioService.obtener(negocioDe(req), leerId(req));
  if (!servicio) {
    throw new HttpError(404, 'Servicio no encontrado');
  }
  res.json(servicio);
}

export async function crear(req: Request, res: Response) {
  const servicio = await servicioService.crear(negocioDe(req), validarDatos(req.body));
  res.status(201).json(servicio);
}

export async function actualizar(req: Request, res: Response) {
  const servicio = await servicioService.actualizar(negocioDe(req), leerId(req), validarDatos(req.body));
  if (!servicio) {
    throw new HttpError(404, 'Servicio no encontrado');
  }
  res.json(servicio);
}

export async function eliminar(req: Request, res: Response) {
  const desactivado = await servicioService.desactivar(negocioDe(req), leerId(req));
  if (!desactivado) {
    throw new HttpError(404, 'Servicio no encontrado');
  }
  res.status(204).send();
}

export async function activar(req: Request, res: Response) {
  const servicio = await servicioService.activar(negocioDe(req), leerId(req));
  if (!servicio) {
    throw new HttpError(404, 'Servicio no encontrado');
  }
  res.json(servicio);
}