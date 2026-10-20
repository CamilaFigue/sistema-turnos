import { Router } from 'express';
import * as serviciosController from '../controllers/servicios.controller';

// Todas estas rutas cuelgan de /api/servicios (ver index.ts)
export const serviciosRouter = Router();

serviciosRouter.get('/', serviciosController.listar);
serviciosRouter.get('/:id', serviciosController.obtener);
serviciosRouter.post('/', serviciosController.crear);
serviciosRouter.put('/:id', serviciosController.actualizar);
serviciosRouter.delete('/:id', serviciosController.eliminar);
serviciosRouter.patch('/:id/activar', serviciosController.activar);