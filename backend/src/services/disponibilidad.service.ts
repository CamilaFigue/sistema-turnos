import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';

// Cada cuántos minutos se ofrece un horario de inicio (09:00, 09:30, 10:00...)
const PASO_MINUTOS = 30;

// Arma todos los horarios de inicio posibles dentro de las franjas del día
// y descarta los que se pisan con un turno existente o ya pasaron.
//   $1 = profesional_id   $2 = fecha ('2026-10-26')   $3 = duración del servicio
//   $4 = paso en minutos  $5 = zona horaria del negocio
const CONSULTA_DISPONIBILIDAD = `
  WITH candidatos AS (
    -- generate_series crea un horario cada $4 minutos, desde el inicio de la franja
    -- hasta el último inicio que todavía permite terminar el servicio dentro de la franja
    SELECT inicio_local
    FROM horarios_atencion h,
         generate_series(
           $2::date + h.hora_inicio,
           $2::date + h.hora_fin - make_interval(mins => $3),
           make_interval(mins => $4)
         ) AS inicio_local
    WHERE h.profesional_id = $1
      AND h.dia_semana = EXTRACT(DOW FROM $2::date)
  ),
  con_zona AS (
    -- Convertimos la hora local del negocio a un instante real (con zona horaria)
    SELECT inicio_local,
           inicio_local AT TIME ZONE $5 AS inicio,
           (inicio_local + make_interval(mins => $3)) AT TIME ZONE $5 AS fin
    FROM candidatos
  )
  SELECT to_char(c.inicio_local, 'HH24:MI') AS hora
  FROM con_zona c
  WHERE c.inicio > NOW()                        -- no ofrecer horarios que ya pasaron
    AND NOT EXISTS (                            -- ni horarios que se pisan con un turno
      SELECT 1 FROM turnos t
      WHERE t.profesional_id = $1
        AND t.estado <> 'cancelado'
        AND t.inicio < c.fin                    -- el turno empieza antes de que termine el candidato
        AND t.fin > c.inicio                    -- y termina después de que empieza el candidato
    )
  ORDER BY c.inicio_local`;

// Devuelve los horarios libres ("09:00", "09:30"...) o null si el profesional no existe
export async function obtener(
  negocioId: number,
  profesionalId: number,
  fecha: string,
  servicioId: number,
): Promise<string[] | null> {
  // 1. El profesional tiene que existir en este negocio
  const profesional = await pool.query<{ activo: boolean; zona_horaria: string }>(
    `SELECT p.activo, n.zona_horaria
     FROM profesionales p
     JOIN negocios n ON n.id = p.negocio_id
     WHERE p.id = $1 AND p.negocio_id = $2`,
    [profesionalId, negocioId],
  );
  if (profesional.rowCount === 0) {
    return null;
  }

  // 2. El servicio tiene que existir, estar activo y ser uno que el profesional realiza
  const servicio = await pool.query<{ duracion_minutos: number; activo: boolean; lo_realiza: boolean }>(
    `SELECT s.duracion_minutos, s.activo, (ps.profesional_id IS NOT NULL) AS lo_realiza
     FROM servicios s
     LEFT JOIN profesional_servicios ps ON ps.servicio_id = s.id AND ps.profesional_id = $2
     WHERE s.id = $1 AND s.negocio_id = $3`,
    [servicioId, profesionalId, negocioId],
  );
  if (servicio.rowCount === 0) {
    throw new HttpError(400, 'El servicio no existe');
  }
  const { duracion_minutos, activo, lo_realiza } = servicio.rows[0];
  if (!activo) {
    throw new HttpError(400, 'El servicio no está activo');
  }
  if (!lo_realiza) {
    throw new HttpError(400, 'El profesional no realiza este servicio');
  }

  // 3. Un profesional desactivado no tiene horarios disponibles
  const { activo: profesionalActivo, zona_horaria } = profesional.rows[0];
  if (!profesionalActivo) {
    return [];
  }

  // 4. Calcular los horarios libres
  const { rows } = await pool.query<{ hora: string }>(CONSULTA_DISPONIBILIDAD, [
    profesionalId,
    fecha,
    duracion_minutos,
    PASO_MINUTOS,
    zona_horaria,
  ]);
  return rows.map((fila) => fila.hora);
}