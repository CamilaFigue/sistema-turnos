import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';
import * as disponibilidadService from './disponibilidad.service';

export type EstadoTurno = 'confirmado' | 'cancelado' | 'completado';

// Forma de un turno tal como lo devuelve la API (fechas y horas en la zona del negocio)
export interface Turno {
  id: number;
  fecha: string; // "2026-10-28"
  hora_inicio: string; // "10:00"
  hora_fin: string; // "10:30"
  estado: EstadoTurno;
  notas: string | null;
  creado_en: Date;
  profesional: { id: number; nombre: string };
  servicio: { id: number; nombre: string; duracion_minutos: number };
  cliente: { id: number; nombre: string; telefono: string; email: string | null };
}

// Al crear un turno devolvemos también su código secreto, para armar el link de cancelación
export type TurnoCreado = Turno & { codigo_cancelacion: string };

// Lo que ve el cliente desde el link de cancelación: sin datos personales
export interface TurnoPublico {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoTurno;
  profesional: string;
  servicio: string;
  se_puede_cancelar: boolean;
}

// Datos que se reciben para reservar un turno
export interface DatosTurno {
  profesional_id: number;
  servicio_id: number;
  fecha: string;
  hora: string;
  notas: string | null;
  cliente: { nombre: string; telefono: string; email: string | null };
}

// Desde qué estado se puede pasar a cuál. Todo turno nace confirmado
// (lo pone la base de datos por defecto); cancelado y completado son finales.
const TRANSICIONES: Record<EstadoTurno, EstadoTurno[]> = {
  confirmado: ['completado', 'cancelado'],
  cancelado: [],
  completado: [],
};

// El cliente puede cancelar desde el link hasta estas horas antes del turno
export const HORAS_MINIMAS_CANCELACION = 2;

// Código de error de Postgres cuando se viola una restricción EXCLUDE
const VIOLACION_EXCLUSION = '23P01';

// Código secreto del link de cancelación: 24 bytes al azar = 32 caracteres.
// Hay tantas combinaciones que es imposible adivinar uno probando.
// base64url usa solo letras, números, "-" y "_": se puede poner en una URL tal cual.
function generarCodigo(): string {
  return randomBytes(24).toString('base64url');
}

// Consulta base: trae el turno con los datos de profesional, servicio y cliente
function consultaTurnos(filtro: string): string {
  return `
    SELECT t.id,
           to_char(t.inicio AT TIME ZONE n.zona_horaria, 'YYYY-MM-DD') AS fecha,
           to_char(t.inicio AT TIME ZONE n.zona_horaria, 'HH24:MI') AS hora_inicio,
           to_char(t.fin AT TIME ZONE n.zona_horaria, 'HH24:MI') AS hora_fin,
           t.estado, t.notas, t.creado_en,
           json_build_object('id', p.id, 'nombre', p.nombre) AS profesional,
           json_build_object('id', s.id, 'nombre', s.nombre, 'duracion_minutos', s.duracion_minutos) AS servicio,
           json_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono, 'email', c.email) AS cliente
    FROM turnos t
    JOIN negocios n      ON n.id = t.negocio_id
    JOIN profesionales p ON p.id = t.profesional_id
    JOIN servicios s     ON s.id = t.servicio_id
    JOIN clientes c      ON c.id = t.cliente_id
    WHERE ${filtro}
    ORDER BY t.inicio`;
}

// Agenda de un día, opcionalmente de un solo profesional
export async function listar(
  negocioId: number,
  fecha: string,
  profesionalId: number | null,
): Promise<Turno[]> {
  const { rows } = await pool.query<Turno>(
    consultaTurnos(`t.negocio_id = $1
      AND (t.inicio AT TIME ZONE n.zona_horaria)::date = $2::date
      AND ($3::bigint IS NULL OR t.profesional_id = $3)`),
    [negocioId, fecha, profesionalId],
  );
  return rows;
}

// profesionalId: si viene, el turno tiene que ser de ese profesional (un profesional solo ve los suyos)
export async function obtener(
  negocioId: number,
  id: number,
  profesionalId: number | null = null,
): Promise<Turno | null> {
  const { rows } = await pool.query<Turno>(
    consultaTurnos('t.id = $1 AND t.negocio_id = $2 AND ($3::bigint IS NULL OR t.profesional_id = $3)'),
    [id, negocioId, profesionalId],
  );
  return rows[0] ?? null;
}

export async function crear(
  negocioId: number,
  datos: DatosTurno,
  { actualizarCliente = true } = {},
): Promise<TurnoCreado> {
  // CAPA 1: el horario tiene que estar entre los disponibles.
  // Reutilizamos la disponibilidad: ya valida profesional, servicio, franjas, bloqueos y superposiciones.
  const libres = await disponibilidadService.obtener(negocioId, datos.profesional_id, datos.fecha, datos.servicio_id);
  if (libres === null) {
    throw new HttpError(400, 'El profesional no existe');
  }
  if (!libres.includes(datos.hora)) {
    throw new HttpError(409, 'El horario elegido no está disponible');
  }

  const codigo = generarCodigo();
  const client = await pool.connect();
  let turnoId: number;
  try {
    await client.query('BEGIN');

    // Si el teléfono ya es cliente del negocio, lo reutilizamos; si no, lo creamos.
    // "ON CONFLICT" usa el UNIQUE (negocio_id, telefono).
    // $5 = actualizarCliente: si es false, el nombre queda como estaba y el email solo se completa si faltaba.
    const cliente = await client.query<{ id: number }>(
      `INSERT INTO clientes (negocio_id, nombre, telefono, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (negocio_id, telefono)
       DO UPDATE SET
         nombre = CASE WHEN $5 THEN EXCLUDED.nombre ELSE clientes.nombre END,
         email = CASE WHEN $5 THEN COALESCE(EXCLUDED.email, clientes.email)
                      ELSE COALESCE(clientes.email, EXCLUDED.email) END
       RETURNING id`,
      [negocioId, datos.cliente.nombre, datos.cliente.telefono, datos.cliente.email, actualizarCliente],
    );

    // Fecha + hora local del negocio -> instante real; el fin se calcula con la duración del servicio
    const turno = await client.query<{ id: number }>(
      `INSERT INTO turnos (negocio_id, profesional_id, servicio_id, cliente_id, inicio, fin, notas, codigo_cancelacion)
       SELECT $1, $2, s.id, $4,
              ($5::date + $6::time) AT TIME ZONE n.zona_horaria,
              ($5::date + $6::time + make_interval(mins => s.duracion_minutos)) AT TIME ZONE n.zona_horaria,
              $7, $8
       FROM servicios s
       JOIN negocios n ON n.id = s.negocio_id
       WHERE s.id = $3 AND s.negocio_id = $1
       RETURNING id`,
      [
        negocioId,
        datos.profesional_id,
        datos.servicio_id,
        cliente.rows[0].id,
        datos.fecha,
        datos.hora,
        datos.notas,
        codigo,
      ],
    );
    turnoId = turno.rows[0].id;

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    // CAPA 2: si otra reserva ganó la carrera, la base de datos rechaza el turno superpuesto
    if ((error as { code?: string }).code === VIOLACION_EXCLUSION) {
      throw new HttpError(409, 'Ese horario acaba de ser reservado por otra persona');
    }
    throw error;
  } finally {
    client.release();
  }

  const turno = (await obtener(negocioId, turnoId))!;
  return { ...turno, codigo_cancelacion: codigo };
}

export async function cambiarEstado(
  negocioId: number,
  id: number,
  nuevoEstado: EstadoTurno,
  profesionalId: number | null = null,
): Promise<Turno | null> {
  // Si el turno es de otro profesional, respondemos igual que si no existiera
  const actual = await pool.query<{ estado: EstadoTurno }>(
    'SELECT estado FROM turnos WHERE id = $1 AND negocio_id = $2 AND ($3::bigint IS NULL OR profesional_id = $3)',
    [id, negocioId, profesionalId],
  );
  if (actual.rowCount === 0) {
    return null;
  }

  const estadoActual = actual.rows[0].estado;
  if (!TRANSICIONES[estadoActual].includes(nuevoEstado)) {
    throw new HttpError(409, `No se puede pasar un turno de "${estadoActual}" a "${nuevoEstado}"`);
  }

  await pool.query('UPDATE turnos SET estado = $1 WHERE id = $2 AND negocio_id = $3', [nuevoEstado, id, negocioId]);
  return obtener(negocioId, id);
}

// Turno visto desde el link de cancelación. null si el código no existe en ese negocio.
export async function obtenerPorCodigo(negocioId: number, codigo: string): Promise<TurnoPublico | null> {
  const { rows } = await pool.query<TurnoPublico>(
    `SELECT to_char(t.inicio AT TIME ZONE n.zona_horaria, 'YYYY-MM-DD') AS fecha,
            to_char(t.inicio AT TIME ZONE n.zona_horaria, 'HH24:MI') AS hora_inicio,
            to_char(t.fin AT TIME ZONE n.zona_horaria, 'HH24:MI') AS hora_fin,
            t.estado,
            p.nombre AS profesional,
            s.nombre AS servicio,
            (t.estado = 'confirmado' AND t.inicio - make_interval(hours => $3) > NOW()) AS se_puede_cancelar
     FROM turnos t
     JOIN negocios n      ON n.id = t.negocio_id
     JOIN profesionales p ON p.id = t.profesional_id
     JOIN servicios s     ON s.id = t.servicio_id
     WHERE t.codigo_cancelacion = $1 AND t.negocio_id = $2`,
    [codigo, negocioId, HORAS_MINIMAS_CANCELACION],
  );
  return rows[0] ?? null;
}

// El cliente cancela su turno desde el link
export async function cancelarPorCodigo(negocioId: number, codigo: string): Promise<TurnoPublico | null> {
  const turno = await obtenerPorCodigo(negocioId, codigo);
  if (!turno) {
    return null;
  }
  if (turno.estado !== 'confirmado') {
    throw new HttpError(409, `Este turno ya está ${turno.estado}`);
  }
  if (!turno.se_puede_cancelar) {
    throw new HttpError(
      409,
      `Faltan menos de ${HORAS_MINIMAS_CANCELACION} horas para el turno: para cancelarlo, comunicate con el consultorio`,
    );
  }

  // Repetimos las condiciones en el UPDATE: si algo cambió entre la consulta y ahora, no cancela
  const { rowCount } = await pool.query(
    `UPDATE turnos SET estado = 'cancelado'
     WHERE codigo_cancelacion = $1 AND negocio_id = $2
       AND estado = 'confirmado' AND inicio - make_interval(hours => $3) > NOW()`,
    [codigo, negocioId, HORAS_MINIMAS_CANCELACION],
  );
  if (rowCount === 0) {
    throw new HttpError(409, 'No se pudo cancelar el turno. Recargá la página y volvé a intentar.');
  }
  return obtenerPorCodigo(negocioId, codigo);
}
