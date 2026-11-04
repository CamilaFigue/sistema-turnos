import { Router } from 'express';
import * as bloqueosController from '../controllers/bloqueos.controller';

// Todas estas rutas cuelgan de /api/bloqueos (ver index.ts).
// Las usan el admin (para cualquier profesional) y cada profesional (para sí mismo).
export const bloqueosRouter = Router();

bloqueosRouter.get('/', bloqueosController.listar);
bloqueosRouter.post('/', bloqueosController.crear);
bloqueosRouter.delete('/:id', bloqueosController.eliminar);
