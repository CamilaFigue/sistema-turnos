import type { NextFunction, Request, Response } from 'express';
import { verificarToken } from '../services/auth.service';
import * as profesionalService from '../services/profesionales.service';
import { HttpError } from '../utils/HttpError';

// Middleware: deja pasar solo los requests con un token válido.
// El token viaja en el header:  Authorization: Bearer eyJhbGciOi...
export function requiereLogin(req: Request, _res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    throw new HttpError(401, 'Tenés que iniciar sesión');
  }

  // Si el token es válido, guardamos quién es para que lo usen los controllers
  req.usuario = verificarToken(token);
  next();
}

// Middleware: deja pasar solo a los administradores. Va siempre después de requiereLogin.
// 403 = "sé quién sos, pero no tenés permiso" (401 es "no sé quién sos").
export function soloAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.usuario?.rol !== 'admin') {
    throw new HttpError(403, 'No tenés permiso para hacer esto');
  }
  next();
}

// Negocio del usuario logueado. Reemplaza al NEGOCIO_ID = 1 temporal:
// cada usuario solo ve y modifica los datos de su propio negocio.
export function negocioDe(req: Request): number {
  if (!req.usuario) {
    throw new HttpError(401, 'Tenés que iniciar sesión');
  }
  return req.usuario.negocio_id;
}

// De qué profesional puede ver y modificar datos el usuario logueado:
//   admin       -> null (de todos)
//   profesional -> el id de su propio profesional
// Lo buscamos en cada request (no lo guardamos en el token) para que,
// si el admin le quita el acceso, deje de funcionar en el momento.
export async function profesionalPermitido(req: Request): Promise<number | null> {
  const negocioId = negocioDe(req);
  if (req.usuario!.rol === 'admin') {
    return null;
  }
  const profesionalId = await profesionalService.idDeUsuario(negocioId, req.usuario!.id);
  if (profesionalId === null) {
    throw new HttpError(403, 'Tu usuario no está vinculado a ningún profesional');
  }
  return profesionalId;
}
