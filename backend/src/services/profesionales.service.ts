import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';
import { hashearPassword } from './auth.service';

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
  email_acceso: string | null; // email con el que entra al panel, si tiene acceso
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
    SELECT p.id, p.nombre, p.usuario_id, u.email AS email_acceso, p.activo, p.creado_en,
           COALESCE(
             json_agg(json_build_object('id', s.id, 'nombre', s.nombre) ORDER BY s.nombre)
               FILTER (WHERE s.id IS NOT NULL),
             '[]'
           ) AS servicios
    FROM profesionales p
    LEFT JOIN profesional_servicios ps ON ps.profesional_id = p.id
    LEFT JOIN servicios s ON s.id = ps.servicio_id
    LEFT JOIN usuarios u ON u.id = p.usuario_id
    WHERE ${filtro}
    GROUP BY p.id, u.email
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

// Id del profesional vinculado a un usuario, o null si el usuario no atiende
export async function idDeUsuario(negocioId: number, usuarioId: number): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    'SELECT id FROM profesionales WHERE usuario_id = $1 AND negocio_id = $2',
    [usuarioId, negocioId],
  );
  return rows[0]?.id ?? null;
}

// Crea un usuario con rol "profesional" y lo vincula al profesional.
// Transacción: si el email ya existe, no queda un usuario creado a medias.
export async function darAcceso(
  negocioId: number,
  id: number,
  email: string,
  password: string,
): Promise<Profesional | null> {
  const passwordHash = await hashearPassword(password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE: bloquea la fila hasta el COMMIT, así dos pedidos simultáneos no crean dos usuarios
    const profesional = await client.query<{ nombre: string; usuario_id: number | null }>(
      'SELECT nombre, usuario_id FROM profesionales WHERE id = $1 AND negocio_id = $2 FOR UPDATE',
      [id, negocioId],
    );
    if (profesional.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    if (profesional.rows[0].usuario_id !== null) {
      throw new HttpError(409, 'Este profesional ya tiene acceso al panel');
    }

    const usuario = await client.query<{ id: number }>(
      `INSERT INTO usuarios (negocio_id, nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'profesional')
       RETURNING id`,
      [negocioId, profesional.rows[0].nombre, email, passwordHash],
    );
    await client.query('UPDATE profesionales SET usuario_id = $1 WHERE id = $2', [usuario.rows[0].id, id]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === VIOLACION_UNIQUE) {
      throw new HttpError(409, 'Ese email ya está en uso');
    }
    throw error;
  } finally {
    client.release();
  }

  return obtener(negocioId, id);
}

// Borra el usuario del profesional: deja de poder entrar al panel.
// La FK "ON DELETE SET NULL" deja al profesional sin usuario_id; sus turnos no se tocan.
export async function quitarAcceso(negocioId: number, id: number): Promise<Profesional | null> {
  const { rows } = await pool.query<{ usuario_id: number | null; rol: string | null }>(
    `SELECT p.usuario_id, u.rol
     FROM profesionales p
     LEFT JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.id = $1 AND p.negocio_id = $2`,
    [id, negocioId],
  );
  if (!rows[0]) {
    return null;
  }
  if (rows[0].usuario_id === null) {
    throw new HttpError(409, 'Este profesional no tiene acceso al panel');
  }
  // Un admin que además atiende (por ejemplo, la dueña) no pierde el acceso desde acá
  if (rows[0].rol !== 'profesional') {
    throw new HttpError(409, 'Este acceso es de un administrador: no se puede quitar desde acá');
  }

  await pool.query('DELETE FROM usuarios WHERE id = $1 AND negocio_id = $2', [rows[0].usuario_id, negocioId]);
  return obtener(negocioId, id);
}
