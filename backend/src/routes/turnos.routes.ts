import { Router } from 'express';
import * as turnosController from '../controllers/turnos.controller';

// Todas estas rutas cuelgan de /api/turnos (ver index.ts)
export const turnosRouter = Router();

turnosRouter.get('/', turnosController.listar);
turnosRouter.get('/:id', turnosController.obtener);
turnosRouter.post('/', turnosController.crear);
turnosRouter.patch('/:id/estado', turnosController.cambiarEstado);