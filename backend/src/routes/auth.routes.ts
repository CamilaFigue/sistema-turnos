import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requiereLogin } from '../middlewares/autenticacion';

// Todas estas rutas cuelgan de /api/auth (ver index.ts)
export const authRouter = Router();

authRouter.post('/login', authController.login); // pública: es la puerta de entrada
authRouter.get('/yo', requiereLogin, authController.yo);