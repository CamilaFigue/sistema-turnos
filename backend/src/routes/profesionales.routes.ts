import { Router } from 'express';
import * as profesionalesController from '../controllers/profesionales.controller';
import * as horariosController from '../controllers/horarios.controller';
import * as disponibilidadController from '../controllers/disponibilidad.controller';

// Todas estas rutas cuelgan de /api/profesionales (ver index.ts)
export const profesionalesRouter = Router();

profesionalesRouter.get('/', profesionalesController.listar);
profesionalesRouter.get('/:id', profesionalesController.obtener);
profesionalesRouter.post('/', profesionalesController.crear);
profesionalesRouter.put('/:id', profesionalesController.actualizar);
profesionalesRouter.delete('/:id', profesionalesController.eliminar);
profesionalesRouter.patch('/:id/activar', profesionalesController.activar);
profesionalesRouter.put('/:id/servicios', profesionalesController.asignarServicios);
// Horarios de atención del profesional
profesionalesRouter.get('/:id/horarios', horariosController.listar);
profesionalesRouter.put('/:id/horarios', horariosController.reemplazar);
// Horarios libres para reservar un servicio en una fecha
profesionalesRouter.get('/:id/disponibilidad', disponibilidadController.obtener);