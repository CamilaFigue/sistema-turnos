import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';
import * as disponibilidadService from './disponibilidad.service';

export type EstadoTurno = 'pendiente' | 'confirmado' | 'cancelado' | 'completado';

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

// Datos que se reciben para reservar un turno
export interface DatosTurno {
  profesional_id: number;
  servicio_id: number;
  fecha: string;
  hora: string;
  notas: string | null;
  cliente: { nombre: string; telefono: string; email: string | null };
}

// Desde qué estado se puede pasar a cuál. Cancelado y completado son finales.
const TRANSICIONES: Record<EstadoTurno, EstadoTurno[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['completado', 'cancelado'],
  cancelado: [],
  completado: [],
};

// Código de error de Postgres cuando se viola una restricción EXCLUDE
const VIOLACION_EXCLUSION = '23P01';

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

export async function obtener(negocioId: number, id: number): Promise<Turno | null> {
  const { rows } = await pool.query<Turno>(consultaTurnos('t.id = $1 AND t.negocio_id = $2'), [id, negocioId]);
  return rows[0] ?? null;
}

export async function crear(negocioId: number, datos: DatosTurno, { actualizarCliente = true } = {}): Promise<Turno> {
  // CAPA 1: el horario tiene que estar entre los disponibles.
  // Reutilizamos la disponibilidad: ya valida profesional, servicio, franjas y superposiciones.
  const libres = await disponibilidadService.obtener(negocioId, datos.profesional_id, datos.fecha, datos.servicio_id);
  if (libres === null) {
    throw new HttpError(400, 'El profesional no existe');
  }
  if (!libres.includes(datos.hora)) {
    throw new HttpError(409, 'El horario elegido no está disponible');
  }

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
      `INSERT INTO turnos (negocio_id, profesional_id, servicio_id, cliente_id, inicio, fin, notas)
       SELECT $1, $2, s.id, $4,
              ($5::date + $6::time) AT TIME ZONE n.zona_horaria,
              ($5::date + $6::time + make_interval(mins => s.duracion_minutos)) AT TIME ZONE n.zona_horaria,
              $7
       FROM servicios s
       JOIN negocios n ON n.id = s.negocio_id
       WHERE s.id = $3 AND s.negocio_id = $1
       RETURNING id`,
      [negocioId, datos.profesional_id, datos.servicio_id, cliente.rows[0].id, datos.fecha, datos.hora, datos.notas],
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

  return (await obtener(negocioId, turnoId))!;
}

export async function cambiarEstado(
  negocioId: number,
  id: number,
  nuevoEstado: EstadoTurno,
): Promise<Turno | null> {
  const actual = await pool.query<{ estado: EstadoTurno }>(
    'SELECT estado FROM turnos WHERE id = $1 AND negocio_id = $2',
    [id, negocioId],
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