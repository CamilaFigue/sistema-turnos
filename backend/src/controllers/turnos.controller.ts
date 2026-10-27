import type { Request, Response } from 'express';
import * as turnoService from '../services/turnos.service';
import type { DatosTurno, EstadoTurno } from '../services/turnos.service';
import { HttpError } from '../utils/HttpError';
import { esEnteroPositivo, leerId, validarFecha, validarHora } from '../utils/validaciones';

// TEMPORAL: cuando hagamos el login, el negocio va a salir del token del usuario
const NEGOCIO_ID = 1;

const ESTADOS: EstadoTurno[] = ['pendiente', 'confirmado', 'cancelado', 'completado'];

function textoOpcional(valor: unknown, campo: string): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  if (typeof valor !== 'string') {
    throw new HttpError(400, `${campo} debe ser texto`);
  }
  return valor.trim() || null;
}

function validarCliente(valor: unknown): DatosTurno['cliente'] {
  const { nombre, telefono, email } = (valor ?? {}) as Record<string, unknown>;

  if (typeof nombre !== 'string' || nombre.trim() === '') {
    throw new HttpError(400, 'El nombre del cliente es obligatorio');
  }

  // Sacamos espacios y guiones para que "11 5555-6666" y "1155556666" sean el mismo cliente
  const telefonoLimpio = typeof telefono === 'string' ? telefono.replace(/[\s-]/g, '') : '';
  if (!/^\+?\d{6,15}$/.test(telefonoLimpio)) {
    throw new HttpError(400, 'El teléfono del cliente es obligatorio y debe tener entre 6 y 15 dígitos');
  }

  const emailLimpio = textoOpcional(email, 'El email');
  if (emailLimpio !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
    throw new HttpError(400, 'El email del cliente no es válido');
  }

  return { nombre: nombre.trim(), telefono: telefonoLimpio, email: emailLimpio };
}

function validarDatos(body: unknown): DatosTurno {
  const { profesional_id, servicio_id, fecha, hora, notas, cliente } = (body ?? {}) as Record<string, unknown>;

  if (!esEnteroPositivo(profesional_id)) {
    throw new HttpError(400, 'profesional_id es obligatorio y debe ser un número entero positivo');
  }
  if (!esEnteroPositivo(servicio_id)) {
    throw new HttpError(400, 'servicio_id es obligatorio y debe ser un número entero positivo');
  }

  return {
    profesional_id,
    servicio_id,
    fecha: validarFecha(fecha),
    hora: validarHora(hora, 'hora'),
    notas: textoOpcional(notas, 'Las notas'),
    cliente: validarCliente(cliente),
  };
}

// GET /api/turnos?fecha=2026-10-28&profesional_id=1  (profesional_id es opcional)
export async function listar(req: Request, res: Response) {
  const fecha = validarFecha(req.query.fecha);

  let profesionalId: number | null = null;
  if (req.query.profesional_id !== undefined) {
    profesionalId = Number(req.query.profesional_id);
    if (typeof req.query.profesional_id !== 'string' || !esEnteroPositivo(profesionalId)) {
      throw new HttpError(400, 'profesional_id debe ser un número entero positivo');
    }
  }

  const turnos = await turnoService.listar(NEGOCIO_ID, fecha, profesionalId);
  res.json(turnos);
}

export async function obtener(req: Request, res: Response) {
  const turno = await turnoService.obtener(NEGOCIO_ID, leerId(req));
  if (!turno) {
    throw new HttpError(404, 'Turno no encontrado');
  }
  res.json(turno);
}

export async function crear(req: Request, res: Response) {
  const turno = await turnoService.crear(NEGOCIO_ID, validarDatos(req.body));
  res.status(201).json(turno);
}

// PATCH /api/turnos/:id/estado  { "estado": "confirmado" }
export async function cambiarEstado(req: Request, res: Response) {
  const id = leerId(req);
  const { estado } = (req.body ?? {}) as Record<string, unknown>;
  if (!ESTADOS.includes(estado as EstadoTurno)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS.join(', ')}`);
  }

  const turno = await turnoService.cambiarEstado(NEGOCIO_ID, id, estado as EstadoTurno);
  if (!turno) {
    throw new HttpError(404, 'Turno no encontrado');
  }
  res.json(turno);
}