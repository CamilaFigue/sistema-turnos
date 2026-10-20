import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/HttpError';

// Responde 404 a cualquier ruta que no exista
export function rutaNoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// Express reconoce un manejador de errores porque recibe 4 parámetros
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Errores que lanzamos a propósito (validaciones, no encontrado, etc.)
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // JSON mal escrito en el body del request
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}