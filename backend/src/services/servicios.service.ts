import { pool } from '../db/pool';

// Forma de un servicio tal como lo devuelve la API
export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio: number;
  activo: boolean;
  creado_en: Date;
}

// Datos que se reciben para crear o actualizar un servicio
export interface DatosServicio {
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio: number;
}

const COLUMNAS = 'id, nombre, descripcion, duracion_minutos, precio, activo, creado_en';

// Todas las consultas filtran por negocio_id: un negocio nunca ve datos de otro

export async function listar(negocioId: number): Promise<Servicio[]> {
  const { rows } = await pool.query<Servicio>(
    `SELECT ${COLUMNAS} FROM servicios WHERE negocio_id = $1 ORDER BY nombre`,
    [negocioId],
  );
  return rows;
}

export async function obtener(negocioId: number, id: number): Promise<Servicio | null> {
  const { rows } = await pool.query<Servicio>(
    `SELECT ${COLUMNAS} FROM servicios WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId],
  );
  return rows[0] ?? null;
}

export async function crear(negocioId: number, datos: DatosServicio): Promise<Servicio> {
  const { rows } = await pool.query<Servicio>(
    `INSERT INTO servicios (negocio_id, nombre, descripcion, duracion_minutos, precio)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNAS}`,
    [negocioId, datos.nombre, datos.descripcion, datos.duracion_minutos, datos.precio],
  );
  return rows[0];
}

export async function actualizar(
  negocioId: number,
  id: number,
  datos: DatosServicio,
): Promise<Servicio | null> {
  const { rows } = await pool.query<Servicio>(
    `UPDATE servicios
     SET nombre = $1, descripcion = $2, duracion_minutos = $3, precio = $4
     WHERE id = $5 AND negocio_id = $6
     RETURNING ${COLUMNAS}`,
    [datos.nombre, datos.descripcion, datos.duracion_minutos, datos.precio, id, negocioId],
  );
  return rows[0] ?? null;
}

// Borrado lógico: no se elimina la fila, se marca como inactiva
export async function desactivar(negocioId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE servicios SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
    [id, negocioId],
  );
  return rowCount === 1;
}

// Revierte el borrado lógico
export async function activar(negocioId: number, id: number): Promise<Servicio | null> {
  const { rows } = await pool.query<Servicio>(
    `UPDATE servicios SET activo = TRUE
     WHERE id = $1 AND negocio_id = $2
     RETURNING ${COLUMNAS}`,
    [id, negocioId],
  );
  return rows[0] ?? null;
}