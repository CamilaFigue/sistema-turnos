import { Router } from 'express';
import * as publicoController from '../controllers/publico.controller';
import { limiteReservas } from '../middlewares/limites';

// Todas estas rutas cuelgan de /api/publico (ver index.ts) y NO piden login
export const publicoRouter = Router();

publicoRouter.get('/:slug', publicoController.obtenerNegocio);
publicoRouter.get('/:slug/disponibilidad', publicoController.disponibilidad);
publicoRouter.post('/:slug/turnos', limiteReservas, publicoController.reservar);
// Link de cancelación: el código secreto reemplaza al login
publicoRouter.get('/:slug/turnos/:codigo', publicoController.verTurno);
publicoRouter.post('/:slug/turnos/:codigo/cancelar', publicoController.cancelarTurno);
