import 'dotenv/config';            // carga .env en process.env (va primero)
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool';

const app = express();
app.use(cors());
app.use(express.json());           // permite leer JSON en el body de los requests

// Ruta de prueba: confirma que el server y la DB responden
app.get('/api/health', async (_req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json({ status: 'ok', dbTime: result.rows[0].now });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});