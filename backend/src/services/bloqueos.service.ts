import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';

// Días en los que un profesional no atiende (franco, vacaciones...), desde y hasta incluidos
export interface Bloqueo {
  id: number;
  profesional: { id: number; nombre: string };
  desde: string; // "2026-12-20"
  hasta: string; // "2027-01-05"
  motivo: string | null;
}

export interface DatosBloqueo {
  profesional_id: number;
  desde: string;
  hasta: string;
  motivo: string | null;
}

// Turno que se canceló por un bloqueo: lo necesario para avisarle al cliente
export interface TurnoAfectado {
  id: number;
  fecha: string;
  hora_inicio: string;
  servicio: string;
  cliente: { nombre: string; telefono: string };
}

// Un bloqueo no puede durar más de un año: evita cancelar media agenda por un error de tipeo
export const DIAS_MAXIMOS = 366;

const CONSULTA_BLOQUEOS = `
  SELECT b.id,
         json_build_object('id', p.id, 'nombre', p.nombre) AS profesional,
         to_char(b.desde, 'YYYY-MM-DD') AS desde,
         to_char(b.hasta, 'YYYY-MM-DD') AS hasta,
         b.motivo
  FROM bloqueos b
  JOIN profesionales p ON p.id = b.profesional_id
  JOIN negocios n      ON n.id = b.negocio_id`;

// Bloqueos que todavía no terminaron (los pasados ya no interesan).
// profesionalId null = de todos los profesionales.
export async function listar(negocioId: number, profesionalId: number | null): Promise<Bloqueo[]> {
  const { rows } = await pool.query<Bloqueo>(
    `${CONSULTA_BLOQUEOS}
     WHERE b.negocio_id = $1
       AND ($2::bigint IS NULL OR b.profesional_id = $2)
       AND b.hasta >= (NOW() AT TIME ZONE n.zona_horaria)::date
     ORDER BY b.desde, p.nombre`,
    [negocioId, profesionalId],
  );
  return rows;
}

// Crea el bloqueo y cancela los turnos confirmados de esos días, todo en una transacción:
// o queda el bloqueo con sus turnos cancelados, o no cambia nada.
export async function crear(
  negocioId: number,
  datos: DatosBloqueo,
): Promise<{ bloqueo: Bloqueo; turnos_cancelados: TurnoAfectado[] }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // El profesional tiene que ser del negocio. De paso calculamos "hoy" en la zona del negocio.
    const profesional = await client.query<{ hoy: string }>(
      `SELECT to_char((NOW() AT TIME ZONE n.zona_horaria)::date, 'YYYY-MM-DD') AS hoy
       FROM profesionales p
       JOIN negocios n ON n.id = p.negocio_id
       WHERE p.id = $1 AND p.negocio_id = $2`,
      [datos.profesional_id, negocioId],
    );
    if (profesional.rowCount === 0) {
      throw new HttpError(400, 'El profesional no existe');
    }
    // Las fechas AAAA-MM-DD se pueden comparar como texto
    if (datos.desde < profesional.rows[0].hoy) {
      throw new HttpError(400, 'No se pueden bloquear días que ya pasaron');
    }

    const nuevo = await client.query<{ id: number }>(
      `INSERT INTO bloqueos (negocio_id, profesional_id, desde, hasta, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [negocioId, datos.profesional_id, datos.desde, datos.hasta, datos.motivo],
    );

    // Cancelamos los turnos confirmados de esos días que todavía no empezaron
    const cancelados = await client.query<{ id: number }>(
      `UPDATE turnos t SET estado = 'cancelado'
       FROM negocios n
       WHERE n.id = t.negocio_id
         AND t.negocio_id = $1
         AND t.profesional_id = $2
         AND t.estado = 'confirmado'
         AND t.inicio > NOW()
         AND (t.inicio AT TIME ZONE n.zona_horaria)::date BETWEEN $3::date AND $4::date
       RETURNING t.id`,
      [negocioId, datos.profesional_id, datos.desde, datos.hasta],
    );

    const afectados = await client.query<TurnoAfectado>(
      `SELECT t.id,
              to_char(t.inicio AT TIME ZONE n.zona_horaria, 'YYYY-MM-DD') AS fecha,
              to_char(t.inicio AT TIME ZONE n.zona_horaria, 'HH24:MI') AS hora_inicio,
              s.nombre AS servicio,
              json_build_object('nombre', c.nombre, 'telefono', c.telefono) AS cliente
       FROM turnos t
       JOIN negocios n  ON n.id = t.negocio_id
       JOIN servicios s ON s.id = t.servicio_id
       JOIN clientes c  ON c.id = t.cliente_id
       WHERE t.id = ANY($1::bigint[])
       ORDER BY t.inicio`,
      [cancelados.rows.map((t) => t.id)],
    );

    const bloqueo = await client.query<Bloqueo>(`${CONSULTA_BLOQUEOS} WHERE b.id = $1`, [nuevo.rows[0].id]);

    await client.query('COMMIT');
    return { bloqueo: bloqueo.rows[0], turnos_cancelados: afectados.rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Quitar un bloqueo vuelve a ofrecer esos días. Los turnos que se cancelaron siguen cancelados.
export async function eliminar(negocioId: number, id: number, profesionalId: number | null): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM bloqueos WHERE id = $1 AND negocio_id = $2 AND ($3::bigint IS NULL OR profesional_id = $3)',
    [id, negocioId, profesionalId],
  );
  return rowCount === 1;
}
