import 'dotenv/config';            // carga .env en process.env (va primero)
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';
import { authRouter } from './routes/auth.routes';
import { serviciosRouter } from './routes/servicios.routes';
import { profesionalesRouter } from './routes/profesionales.routes';
import { turnosRouter } from './routes/turnos.routes';
import { requiereLogin } from './middlewares/autenticacion';
import { errorHandler, rutaNoEncontrada } from './middlewares/errorHandler';

const app = express();
app.use(cors());
app.use(express.json());           // permite leer JSON en el body de los requests

// Ruta de prueba: confirma que el server y la DB responden
app.get('/api/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json({ status: 'ok', dbTime: result.rows[0].now });
});

// Rutas públicas
app.use('/api/auth', authRouter);

// Rutas del panel: requiereLogin corre antes que cada router y corta si no hay sesión
app.use('/api/servicios', requiereLogin, serviciosRouter);
app.use('/api/profesionales', requiereLogin, profesionalesRouter);
app.use('/api/turnos', requiereLogin, turnosRouter);

// Siempre al final: primero el 404, después el manejador de errores
app.use(rutaNoEncontrada);
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});