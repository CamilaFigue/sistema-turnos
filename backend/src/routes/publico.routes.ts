import { Router } from 'express';
import * as publicoController from '../controllers/publico.controller';

// Todas estas rutas cuelgan de /api/publico (ver index.ts) y NO piden login
export const publicoRouter = Router();

publicoRouter.get('/:slug', publicoController.obtenerNegocio);
publicoRouter.get('/:slug/disponibilidad', publicoController.disponibilidad);
publicoRouter.post('/:slug/turnos', publicoController.reservar);