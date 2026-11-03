import 'dotenv/config';            // carga .env en process.env (va primero)
import path from 'node:path';
import express from 'express';
import { pool } from './db/pool';
import { authRouter } from './routes/auth.routes';
import { serviciosRouter } from './routes/servicios.routes';
import { profesionalesRouter } from './routes/profesionales.routes';
import { turnosRouter } from './routes/turnos.routes';
import { publicoRouter } from './routes/publico.routes';
import { requiereLogin } from './middlewares/autenticacion';
import { limiteGeneral } from './middlewares/limites';
import { errorHandler, rutaNoEncontrada } from './middlewares/errorHandler';

const app = express();

// En Render, cada petición pasa por proxies antes de llegar a Express.
// Con esto, req.ip es la IP real del visitante y no la de un proxy.
// En tu PC no hay proxy: si la variable no existe, queda en 0.
app.set('trust proxy', Number(process.env.PROXIES_CONFIABLES ?? 0));

app.use(express.json());           // permite leer JSON en el body de los requests
app.use('/api', limiteGeneral);    // tope general de peticiones por IP

// Ruta de prueba: confirma que el server y la DB responden
app.get('/api/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json({ status: 'ok', dbTime: result.rows[0].now });
});

// Devuelve la IP con la que el servidor te ve. Sirve para comprobar que
// PROXIES_CONFIABLES está bien: tiene que coincidir con tu IP pública.
app.get('/api/mi-ip', (req, res) => {
  res.json({ ip: req.ip });
});

// Rutas públicas
app.use('/api/auth', authRouter);
app.use('/api/publico', publicoRouter);  // página de reservas para pacientes

// Rutas del panel: requiereLogin corre antes que cada router y corta si no hay sesión
app.use('/api/servicios', requiereLogin, serviciosRouter);
app.use('/api/profesionales', requiereLogin, profesionalesRouter);
app.use('/api/turnos', requiereLogin, turnosRouter);

// Una ruta /api que no existe siempre responde 404 en JSON, nunca la página de Vue
app.use('/api', rutaNoEncontrada);

// En producción, este mismo servidor entrega el frontend ya compilado
if (process.env.NODE_ENV === 'production') {
  const carpetaFrontend = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(carpetaFrontend));

  // Cualquier otra URL (/agenda, /reservar/...) devuelve index.html y Vue Router muestra la pantalla
  app.get('/{*ruta}', (_req, res) => {
    res.sendFile(path.join(carpetaFrontend, 'index.html'));
  });
}

// Siempre al final: primero el 404, después el manejador de errores
app.use(rutaNoEncontrada);
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});