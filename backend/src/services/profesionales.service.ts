import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';

// Servicio asignado, en versión resumida (solo lo que necesita el frontend)
export interface ServicioAsignado {
  id: number;
  nombre: string;
}

// Forma de un profesional tal como lo devuelve la API
export interface Profesional {
  id: number;
  nombre: string;
  usuario_id: number | null;
  activo: boolean;
  creado_en: Date;
  servicios: ServicioAsignado[];
}

// Datos que se reciben para crear o actualizar un profesional
export interface DatosProfesional {
  nombre: string;
  usuario_id: number | null;
}

// Consulta base: trae cada profesional con sus servicios en un array JSON.
// Recibe el filtro del WHERE para reutilizarla en listar y obtener.
function consultaProfesionales(filtro: string): string {
  return `
    SELECT p.id, p.nombre, p.usuario_id, p.activo, p.creado_en,
           COALESCE(
             json_agg(json_build_object('id', s.id, 'nombre', s.nombre) ORDER BY s.nombre)
               FILTER (WHERE s.id IS NOT NULL),
             '[]'
           ) AS servicios
    FROM profesionales p
    LEFT JOIN profesional_servicios ps ON ps.profesional_id = p.id
    LEFT JOIN servicios s ON s.id = ps.servicio_id
    WHERE ${filtro}
    GROUP BY p.id
    ORDER BY p.nombre`;
}

// Código de error de Postgres cuando se viola un UNIQUE
const VIOLACION_UNIQUE = '23505';

// Si viene un usuario, tiene que existir y ser del mismo negocio
async function verificarUsuario(negocioId: number, usuarioId: number | null): Promise<void> {
  if (usuarioId === null) {
    return;
  }
  const { rowCount } = await pool.query(
    'SELECT 1 FROM usuarios WHERE id = $1 AND negocio_id = $2',
    [usuarioId, negocioId],
  );
  if (rowCount === 0) {
    throw new HttpError(400, 'El usuario indicado no existe');
  }
}

// Convierte el error de UNIQUE de usuario_id en un 409 con mensaje claro
function traducirError(error: unknown): never {
  if ((error as { code?: string }).code === VIOLACION_UNIQUE) {
    throw new HttpError(409, 'Ese usuario ya está asignado a otro profesional');
  }
  throw error;
}

// Todas las consultas filtran por negocio_id: un negocio nunca ve datos de otro

export async function listar(negocioId: number): Promise<Profesional[]> {
  const { rows } = await pool.query<Profesional>(consultaProfesionales('p.negocio_id = $1'), [negocioId]);
  return rows;
}

export async function obtener(negocioId: number, id: number): Promise<Profesional | null> {
  const { rows } = await pool.query<Profesional>(
    consultaProfesionales('p.id = $1 AND p.negocio_id = $2'),
    [id, negocioId],
  );
  return rows[0] ?? null;
}

export async function crear(negocioId: number, datos: DatosProfesional): Promise<Profesional> {
  await verificarUsuario(negocioId, datos.usuario_id);
  try {
    const { rows } = await pool.query<{ id: number }>(
      'INSERT INTO profesionales (negocio_id, usuario_id, nombre) VALUES ($1, $2, $3) RETURNING id',
      [negocioId, datos.usuario_id, datos.nombre],
    );
    // Lo volvemos a leer para devolverlo con el mismo formato que el resto (con servicios)
    return (await obtener(negocioId, rows[0].id))!;
  } catch (error) {
    traducirError(error);
  }
}

export async function actualizar(
  negocioId: number,
  id: number,
  datos: DatosProfesional,
): Promise<Profesional | null> {
  await verificarUsuario(negocioId, datos.usuario_id);
  try {
    const { rowCount } = await pool.query(
      'UPDATE profesionales SET nombre = $1, usuario_id = $2 WHERE id = $3 AND negocio_id = $4',
      [datos.nombre, datos.usuario_id, id, negocioId],
    );
    if (rowCount === 0) {
      return null;
    }
    return obtener(negocioId, id);
  } catch (error) {
    traducirError(error);
  }
}

// Borrado lógico: no se elimina la fila, se marca como inactiva
export async function desactivar(negocioId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE profesionales SET activo = FALSE WHERE id = $1 AND negocio_id = $2',
    [id, negocioId],
  );
  return rowCount === 1;
}

// Revierte el borrado lógico
export async function activar(negocioId: number, id: number): Promise<Profesional | null> {
  const { rowCount } = await pool.query(
    'UPDATE profesionales SET activo = TRUE WHERE id = $1 AND negocio_id = $2',
    [id, negocioId],
  );
  if (rowCount === 0) {
    return null;
  }
  return obtener(negocioId, id);
}

// Reemplaza los servicios del profesional por los recibidos.
// Usa una transacción: o se aplican todos los cambios, o ninguno.
export async function asignarServicios(
  negocioId: number,
  id: number,
  servicioIds: number[],
): Promise<Profesional | null> {
  const ids = [...new Set(servicioIds)]; // sin repetidos

  // Una transacción necesita usar siempre la MISMA conexión
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const profesional = await client.query(
      'SELECT 1 FROM profesionales WHERE id = $1 AND negocio_id = $2',
      [id, negocioId],
    );
    if (profesional.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Todos los servicios tienen que existir y ser de este negocio
    if (ids.length > 0) {
      const { rows } = await client.query<{ cantidad: number }>(
        'SELECT COUNT(*)::int AS cantidad FROM servicios WHERE negocio_id = $1 AND id = ANY($2::bigint[])',
        [negocioId, ids],
      );
      if (rows[0].cantidad !== ids.length) {
        throw new HttpError(400, 'Uno o más servicios no existen');
      }
    }

    await client.query('DELETE FROM profesional_servicios WHERE profesional_id = $1', [id]);

    if (ids.length > 0) {
      await client.query(
        'INSERT INTO profesional_servicios (profesional_id, servicio_id) SELECT $1, unnest($2::bigint[])',
        [id, ids],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK'); // algo falló: se deshace todo
    throw error;
  } finally {
    client.release(); // SIEMPRE devolver la conexión al pool
  }

  return obtener(negocioId, id);
}