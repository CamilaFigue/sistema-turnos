import { Router } from 'express';
import * as turnosController from '../controllers/turnos.controller';
import { soloAdmin } from '../middlewares/autenticacion';

// Todas estas rutas cuelgan de /api/turnos (ver index.ts).
// Un profesional también entra acá, pero el controller le limita los turnos a los suyos.
export const turnosRouter = Router();

turnosRouter.get('/', turnosController.listar);
turnosRouter.get('/:id', turnosController.obtener);
turnosRouter.post('/', soloAdmin, turnosController.crear); // cargar turnos desde el panel: solo admin
turnosRouter.patch('/:id/estado', turnosController.cambiarEstado);
