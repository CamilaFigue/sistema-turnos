import { pool } from '../db/pool';

// Datos del negocio que se pueden mostrar a cualquiera
export interface NegocioPublico {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
}

// Un servicio reservable, con los profesionales activos que lo realizan
export interface ServicioPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  precio: number;
  profesionales: { id: number; nombre: string }[];
}

// Busca el negocio por su slug: la parte de la URL que lo identifica
// (/reservar/consultorio-salud-integral)
export async function negocioPorSlug(slug: string): Promise<NegocioPublico | null> {
  const { rows } = await pool.query<NegocioPublico>(
    'SELECT id, nombre, telefono, direccion FROM negocios WHERE slug = $1',
    [slug],
  );
  return rows[0] ?? null;
}

// Solo servicios activos que al menos un profesional activo realiza:
// no tiene sentido ofrecer algo que nadie puede atender
export async function serviciosReservables(negocioId: number): Promise<ServicioPublico[]> {
  const { rows } = await pool.query<ServicioPublico>(
    `SELECT s.id, s.nombre, s.descripcion, s.duracion_minutos, s.precio,
            json_agg(json_build_object('id', p.id, 'nombre', p.nombre) ORDER BY p.nombre) AS profesionales
     FROM servicios s
     JOIN profesional_servicios ps ON ps.servicio_id = s.id
     JOIN profesionales p ON p.id = ps.profesional_id AND p.activo
     WHERE s.negocio_id = $1 AND s.activo
     GROUP BY s.id
     ORDER BY s.nombre`,
    [negocioId],
  );
  return rows;
}