// Le agrega a la Request de Express el usuario que deja el middleware de autenticación.
// Así TypeScript sabe que existe req.usuario y qué forma tiene.
import type { UsuarioToken } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export {};