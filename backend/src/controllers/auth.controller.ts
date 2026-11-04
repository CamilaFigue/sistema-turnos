import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { HttpError } from '../utils/HttpError';

// POST /api/auth/login  { "email": "...", "password": "..." }
export async function login(req: Request, res: Response) {
  const { email, password } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof email !== 'string' || email.trim() === '') {
    throw new HttpError(400, 'El email es obligatorio');
  }
  if (typeof password !== 'string' || password === '') {
    throw new HttpError(400, 'La contraseña es obligatoria');
  }

  const sesion = await authService.login(email.trim(), password);
  res.json(sesion);
}

// GET /api/auth/yo  -> datos del usuario del token (el frontend lo usa al recargar la página)
export async function yo(req: Request, res: Response) {
  const usuario = await authService.obtenerSesion(req.usuario!.id);
  if (!usuario) {
    // El token es válido pero el usuario se desactivó después de iniciar sesión
    throw new HttpError(401, 'Tu usuario ya no está activo');
  }
  res.json(usuario);
}

// Exportada: dar acceso a un profesional valida la contraseña inicial con la misma regla
export function validarPasswordNueva(valor: unknown): string {
  if (typeof valor !== 'string' || valor.length < authService.LARGO_MINIMO_PASSWORD) {
    throw new HttpError(400, `La contraseña debe tener al menos ${authService.LARGO_MINIMO_PASSWORD} caracteres`);
  }
  return valor;
}

// POST /api/auth/cambiar-password  { "actual": "...", "nueva": "..." }
export async function cambiarPassword(req: Request, res: Response) {
  const { actual, nueva } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof actual !== 'string' || actual === '') {
    throw new HttpError(400, 'La contraseña actual es obligatoria');
  }
  const passwordNueva = validarPasswordNueva(nueva);
  if (passwordNueva === actual) {
    throw new HttpError(400, 'La contraseña nueva tiene que ser distinta de la actual');
  }

  await authService.cambiarPassword(req.usuario!.id, actual, passwordNueva);
  res.status(204).send();
}
