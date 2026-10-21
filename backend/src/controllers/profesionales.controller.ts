import type { Request, Response } from 'express';
import * as profesionalService from '../services/profesionales.service';
import type { DatosProfesional } from '../services/profesionales.service';
import { HttpError } from '../utils/HttpError';

// TEMPORAL: cuando hagamos el login, el negocio va a salir del token del usuario
const NEGOCIO_ID = 1;

function esEnteroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

function leerId(req: Request): number {
  const id = Number(req.params.id);
  if (!esEnteroPositivo(id)) {
    throw new HttpError(400, 'El id debe ser un número entero positivo');
  }
  return id;
}

// Revisa el body y devuelve los datos limpios, o lanza un error 400
function validarDatos(body: unknown): DatosProfesional {
  const { nombre, usuario_id } = (body ?? {}) as Record<string, unknown>;

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new HttpError(400, 'El nombre es obligatorio');
  }

  // usuario_id es opcional: si no viene o viene null, el profesional no tiene usuario
  let usuarioId: number | null = null;
  if (usuario_id !== undefined && usuario_id !== null) {
    if (!esEnteroPositivo(usuario_id)) {
      throw new HttpError(400, 'El usuario_id debe ser un número entero positivo o null');
    }
    usuarioId = usuario_id;
  }

  return { nombre: nombre.trim(), usuario_id: usuarioId };
}

function validarServicioIds(body: unknown): number[] {
  const { servicio_ids } = (body ?? {}) as Record<string, unknown>;

  if (!Array.isArray(servicio_ids) || !servicio_ids.every(esEnteroPositivo)) {
    throw new HttpError(400, 'servicio_ids debe ser una lista de ids (números enteros positivos)');
  }
  return servicio_ids;
}

export async function listar(_req: Request, res: Response) {
  const profesionales = await profesionalService.listar(NEGOCIO_ID);
  res.json(profesionales);
}

export async function obtener(req: Request, res: Response) {
  const profesional = await profesionalService.obtener(NEGOCIO_ID, leerId(req));
  if (!profesional) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(profesional);
}

export async function crear(req: Request, res: Response) {
  const profesional = await profesionalService.crear(NEGOCIO_ID, validarDatos(req.body));
  res.status(201).json(profesional);
}

export async function actualizar(req: Request, res: Response) {
  const profesional = await profesionalService.actualizar(NEGOCIO_ID, leerId(req), validarDatos(req.body));
  if (!profesional) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(profesional);
}

export async function eliminar(req: Request, res: Response) {
  const desactivado = await profesionalService.desactivar(NEGOCIO_ID, leerId(req));
  if (!desactivado) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.status(204).send();
}

export async function activar(req: Request, res: Response) {
  const profesional = await profesionalService.activar(NEGOCIO_ID, leerId(req));
  if (!profesional) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(profesional);
}

export async function asignarServicios(req: Request, res: Response) {
  const profesional = await profesionalService.asignarServicios(
    NEGOCIO_ID,
    leerId(req),
    validarServicioIds(req.body),
  );
  if (!profesional) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(profesional);
}