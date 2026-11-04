import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requiereLogin } from '../middlewares/autenticacion';
import { limiteLogin } from '../middlewares/limites';

// Todas estas rutas cuelgan de /api/auth (ver index.ts)
export const authRouter = Router();

authRouter.post('/login', limiteLogin, authController.login); // pública: es la puerta de entrada
authRouter.get('/yo', requiereLogin, authController.yo);
// limiteLogin también acá: si alguien deja la sesión abierta, no puede probar contraseñas sin fin
authRouter.post('/cambiar-password', requiereLogin, limiteLogin, authController.cambiarPassword);
