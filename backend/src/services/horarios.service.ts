import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';

// Una franja de trabajo semanal, tal como la devuelve la API
export interface Horario {
  id: number;
  dia_semana: number; // 0 = domingo ... 6 = sábado
  hora_inicio: string; // "09:00"
  hora_fin: string; // "13:00"
}

// Datos que se reciben para cargar una franja
export interface DatosHorario {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// to_char formatea el TIME de Postgres ("09:00:00") como "09:00"
const COLUMNAS = `id, dia_semana,
  to_char(hora_inicio, 'HH24:MI') AS hora_inicio,
  to_char(hora_fin, 'HH24:MI') AS hora_fin`;

// Regla de negocio: en un mismo día, las franjas no se pueden pisar
function verificarSinSuperposicion(horarios: DatosHorario[]): void {
  // Ordenamos por día y hora de inicio: así solo hay que comparar cada franja con la anterior
  const ordenados = [...horarios].sort(
    (a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio),
  );

  for (let i = 1; i < ordenados.length; i++) {
    const anterior = ordenados[i - 1];
    const actual = ordenados[i];
    // Los horarios "HH:MM" se pueden comparar como texto porque siempre tienen 2 dígitos
    if (actual.dia_semana === anterior.dia_semana && actual.hora_inicio < anterior.hora_fin) {
      throw new HttpError(
        400,
        `Las franjas del ${DIAS[actual.dia_semana]} se superponen ` +
          `(${anterior.hora_inicio}-${anterior.hora_fin} y ${actual.hora_inicio}-${actual.hora_fin})`,
      );
    }
  }
}

// Devuelve null si el profesional no existe (o es de otro negocio)
export async function listar(negocioId: number, profesionalId: number): Promise<Horario[] | null> {
  const profesional = await pool.query(
    'SELECT 1 FROM profesionales WHERE id = $1 AND negocio_id = $2',
    [profesionalId, negocioId],
  );
  if (profesional.rowCount === 0) {
    return null;
  }

  const { rows } = await pool.query<Horario>(
    `SELECT ${COLUMNAS} FROM horarios_atencion
     WHERE profesional_id = $1
     ORDER BY dia_semana, hora_inicio`,
    [profesionalId],
  );
  return rows;
}

// Reemplaza la semana completa del profesional por las franjas recibidas.
// Igual que con los servicios: transacción, o se aplica todo o nada.
export async function reemplazar(
  negocioId: number,
  profesionalId: number,
  horarios: DatosHorario[],
): Promise<Horario[] | null> {
  verificarSinSuperposicion(horarios);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const profesional = await client.query(
      'SELECT 1 FROM profesionales WHERE id = $1 AND negocio_id = $2',
      [profesionalId, negocioId],
    );
    if (profesional.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query('DELETE FROM horarios_atencion WHERE profesional_id = $1', [profesionalId]);

    if (horarios.length > 0) {
      // unnest con 3 arrays arma una fila por posición: (dia[0], inicio[0], fin[0]), (dia[1], ...)
      await client.query(
        `INSERT INTO horarios_atencion (profesional_id, dia_semana, hora_inicio, hora_fin)
         SELECT $1, dia, inicio::time, fin::time
         FROM unnest($2::smallint[], $3::text[], $4::text[]) AS franja(dia, inicio, fin)`,
        [
          profesionalId,
          horarios.map((h) => h.dia_semana),
          horarios.map((h) => h.hora_inicio),
          horarios.map((h) => h.hora_fin),
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return listar(negocioId, profesionalId);
}