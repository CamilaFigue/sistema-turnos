import { Pool, types } from 'pg';

// Por defecto, pg devuelve BIGINT y NUMERIC como texto para no perder precisión.
// Nuestros ids nunca van a ser tan grandes y los precios solo se muestran,
// así que los convertimos a number para que el JSON sea más cómodo de usar.
types.setTypeParser(types.builtins.INT8, (valor) => parseInt(valor, 10));
types.setTypeParser(types.builtins.NUMERIC, (valor) => parseFloat(valor));

// Un "pool" mantiene varias conexiones abiertas y las reutiliza
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});