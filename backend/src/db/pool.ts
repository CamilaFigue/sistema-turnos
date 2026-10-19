import { Pool } from 'pg';

// Un "pool" mantiene varias conexiones abiertas y las reutiliza
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});