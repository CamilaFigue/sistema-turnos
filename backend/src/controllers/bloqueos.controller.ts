import type { Request, Response } from 'express';
import * as bloqueoService from '../services/bloqueos.service';
import type { DatosBloqueo } from '../services/bloqueos.service';
import { HttpError } from '../utils/HttpError';
import { negocioDe, profesionalPermitido } from '../middlewares/autenticacion';
import { esEnteroPositivo, leerId, validarFecha } from '../utils/validaciones';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

// permitido: el profesional del usuario logueado, o null si es admin
function validarDatos(body: unknown, permitido: number | null): DatosBloqueo {
  const { profesional_id, desde, hasta, motivo } = (body ?? {}) as Record<string, unknown>;

  // Un profesional solo bloquea sus propios días: ignoramos lo que mande en profesional_id.
  // El admin tiene que decir de quién es el bloqueo.
  let profesionalId: number;
  if (permitido !== null) {
    profesionalId = permitido;
  } else if (esEnteroPositivo(profesional_id)) {
    profesionalId = profesional_id;
  } else {
    throw new HttpError(400, 'profesional_id es obligatorio y debe ser un número entero positivo');
  }

  const fechaDesde = validarFecha(desde);
  const fechaHasta = validarFecha(hasta);
  if (fechaHasta < fechaDesde) {
    throw new HttpError(400, 'La fecha "hasta" no puede ser anterior a "desde"');
  }
  const dias = (Date.parse(fechaHasta) - Date.parse(fechaDesde)) / MILISEGUNDOS_POR_DIA + 1;
  if (dias > bloqueoService.DIAS_MAXIMOS) {
    throw new HttpError(400, 'Un bloqueo no puede durar más de un año');
  }

  if (motivo !== undefined && motivo !== null && typeof motivo !== 'string') {
    throw new HttpError(400, 'El motivo debe ser texto');
  }
  const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
  if (motivoLimpio.length > 200) {
    throw new HttpError(400, 'El motivo no puede tener más de 200 caracteres');
  }

  return { profesional_id: profesionalId, desde: fechaDesde, hasta: fechaHasta, motivo: motivoLimpio || null };
}

// GET /api/bloqueos  -> bloqueos vigentes (un profesional ve solo los suyos)
export async function listar(req: Request, res: Response) {
  const bloqueos = await bloqueoService.listar(negocioDe(req), await profesionalPermitido(req));
  res.json(bloqueos);
}

// POST /api/bloqueos  { "profesional_id": 1, "desde": "2026-12-20", "hasta": "2027-01-05", "motivo": "Vacaciones" }
export async function crear(req: Request, res: Response) {
  const datos = validarDatos(req.body, await profesionalPermitido(req));
  const resultado = await bloqueoService.crear(negocioDe(req), datos);
  res.status(201).json(resultado);
}

// DELETE /api/bloqueos/:id
export async function eliminar(req: Request, res: Response) {
  const eliminado = await bloqueoService.eliminar(negocioDe(req), leerId(req), await profesionalPermitido(req));
  if (!eliminado) {
    throw new HttpError(404, 'Bloqueo no encontrado');
  }
  res.status(204).send();
}
