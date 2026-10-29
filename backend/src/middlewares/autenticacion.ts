import type { NextFunction, Request, Response } from 'express';
import { verificarToken } from '../services/auth.service';
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

// Negocio del usuario logueado. Reemplaza al NEGOCIO_ID = 1 temporal:
// cada usuario solo ve y modifica los datos de su propio negocio.
export function negocioDe(req: Request): number {
  if (!req.usuario) {
    throw new HttpError(401, 'Tenés que iniciar sesión');
  }
  return req.usuario.negocio_id;
}