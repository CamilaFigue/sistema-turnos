import { Router } from 'express';
import * as profesionalesController from '../controllers/profesionales.controller';

// Todas estas rutas cuelgan de /api/profesionales (ver index.ts)
export const profesionalesRouter = Router();

profesionalesRouter.get('/', profesionalesController.listar);
profesionalesRouter.get('/:id', profesionalesController.obtener);
profesionalesRouter.post('/', profesionalesController.crear);
profesionalesRouter.put('/:id', profesionalesController.actualizar);
profesionalesRouter.delete('/:id', profesionalesController.eliminar);
profesionalesRouter.patch('/:id/activar', profesionalesController.activar);
profesionalesRouter.put('/:id/servicios', profesionalesController.asignarServicios);