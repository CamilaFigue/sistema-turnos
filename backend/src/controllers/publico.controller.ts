import type { Request, Response } from 'express';
import * as publicoService from '../services/publico.service';
import * as disponibilidadService from '../services/disponibilidad.service';
import * as turnoService from '../services/turnos.service';
import { validarDatos } from './turnos.controller';
import { HttpError } from '../utils/HttpError';
import { esEnteroPositivo, validarFecha } from '../utils/validaciones';

// Estas rutas no tienen login: el negocio sale del slug de la URL, no de un token

async function leerNegocio(req: Request): Promise<publicoService.NegocioPublico> {
  const negocio = await publicoService.negocioPorSlug(String(req.params.slug));
  if (!negocio) {
    throw new HttpError(404, 'No encontramos ese consultorio. Revisá el link.');
  }
  return negocio;
}

// Los parámetros de la query string llegan como texto: "3" -> 3
function leerIdDeQuery(valor: unknown, campo: string): number {
  const id = Number(valor);
  if (typeof valor !== 'string' || !esEnteroPositivo(id)) {
    throw new HttpError(400, `${campo} es obligatorio y debe ser un número entero positivo`);
  }
  return id;
}

// GET /api/publico/:slug  -> datos del negocio y qué se puede reservar
export async function obtenerNegocio(req: Request, res: Response) {
  const negocio = await leerNegocio(req);
  const servicios = await publicoService.serviciosReservables(negocio.id);
  res.json({
    nombre: negocio.nombre,
    telefono: negocio.telefono,
    direccion: negocio.direccion,
    servicios,
  });
}

// GET /api/publico/:slug/disponibilidad?profesional_id=1&servicio_id=1&fecha=2026-11-02
export async function disponibilidad(req: Request, res: Response) {
  const negocio = await leerNegocio(req);
  const horarios = await disponibilidadService.obtener(
    negocio.id,
    leerIdDeQuery(req.query.profesional_id, 'profesional_id'),
    validarFecha(req.query.fecha),
    leerIdDeQuery(req.query.servicio_id, 'servicio_id'),
  );
  if (!horarios) {
    throw new HttpError(404, 'Profesional no encontrado');
  }
  res.json(horarios);
}

// POST /api/publico/:slug/turnos  -> el paciente reserva su turno
export async function reservar(req: Request, res: Response) {
  const negocio = await leerNegocio(req);
  // actualizarCliente: false -> si el teléfono ya existe, no se pisan los datos guardados
  const turno = await turnoService.crear(negocio.id, validarDatos(req.body), {
    actualizarCliente: false,
  });

  // Devolvemos solo lo necesario para la confirmación. Nunca los datos del cliente:
  // si alguien reservara con el teléfono de otra persona, vería su email.
  res.status(201).json({
    fecha: turno.fecha,
    hora_inicio: turno.hora_inicio,
    hora_fin: turno.hora_fin,
    profesional: turno.profesional.nombre,
    servicio: turno.servicio.nombre,
  });
}