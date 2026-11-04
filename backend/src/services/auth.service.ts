import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db/pool';
import { HttpError } from '../utils/HttpError';

// admin: gestiona todo el panel | profesional: solo su agenda y sus días bloqueados
export type Rol = 'admin' | 'profesional';

// Lo que guardamos dentro del token: lo mínimo para saber quién es y de qué negocio
export interface UsuarioToken {
  id: number;
  negocio_id: number;
  rol: Rol;
}

// Lo que ve el frontend del usuario logueado (nunca el password_hash)
export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  negocio: { id: number; nombre: string; slug: string };
  profesional: { id: number; nombre: string } | null; // si el usuario además atiende
}

const CONSULTA_USUARIO = `
  SELECT u.id, u.nombre, u.email, u.rol,
        json_build_object('id', n.id, 'nombre', n.nombre, 'slug', n.slug) AS negocio,
        CASE WHEN p.id IS NULL THEN NULL
             ELSE json_build_object('id', p.id, 'nombre', p.nombre) END AS profesional
  FROM usuarios u
  JOIN negocios n ON n.id = u.negocio_id
  LEFT JOIN profesionales p ON p.usuario_id = u.id`;

// Hash de una contraseña cualquiera. Si el email no existe, comparamos contra este igual,
// para que la respuesta tarde lo mismo y no se pueda adivinar qué emails están registrados.
const HASH_FALSO = '$2b$10$BkNWQTcbV7xbnkJIggZWNOzV9.OEECKsbF5905R9JnEc8fDlQofIu';

// Mismo mensaje para email inexistente y contraseña incorrecta: no damos pistas
const CREDENCIALES_INVALIDAS = 'Email o contraseña incorrectos';

// Largo mínimo de una contraseña nueva
export const LARGO_MINIMO_PASSWORD = 8;

// bcrypt guarda el hash junto con su "costo" (cuántas vueltas hace). 10 es el valor habitual.
export function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; usuario: UsuarioSesion }> {
  const { rows } = await pool.query<{
    id: number;
    negocio_id: number;
    rol: Rol;
    password_hash: string;
  }>(
    'SELECT id, negocio_id, rol, password_hash FROM usuarios WHERE LOWER(email) = LOWER($1) AND activo',
    [email],
  );
  const usuario = rows[0];

  // bcrypt.compare vuelve a calcular el hash con la contraseña recibida y lo compara con el guardado
  const passwordOk = await bcrypt.compare(password, usuario?.password_hash ?? HASH_FALSO);
  if (!usuario || !passwordOk) {
    throw new HttpError(401, CREDENCIALES_INVALIDAS);
  }

  const datosToken: UsuarioToken = {
    id: usuario.id,
    negocio_id: usuario.negocio_id,
    rol: usuario.rol,
  };
  const token = jwt.sign(datosToken, config.jwtSecreto, {
    expiresIn: config.jwtDuracion as SignOptions['expiresIn'],
  });

  return { token, usuario: (await obtenerSesion(usuario.id))! };
}

// Verifica la firma y el vencimiento del token. Si algo no cierra, lanza un 401.
export function verificarToken(token: string): UsuarioToken {
  try {
    const datos = jwt.verify(token, config.jwtSecreto) as UsuarioToken;
    return { id: datos.id, negocio_id: datos.negocio_id, rol: datos.rol };
  } catch {
    throw new HttpError(401, 'La sesión venció o no es válida. Volvé a iniciar sesión.');
  }
}

export async function obtenerSesion(usuarioId: number): Promise<UsuarioSesion | null> {
  const { rows } = await pool.query<UsuarioSesion>(`${CONSULTA_USUARIO} WHERE u.id = $1 AND u.activo`, [
    usuarioId,
  ]);
  return rows[0] ?? null;
}

// El usuario logueado cambia su propia contraseña: tiene que saber la actual
export async function cambiarPassword(usuarioId: number, actual: string, nueva: string): Promise<void> {
  const { rows } = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM usuarios WHERE id = $1 AND activo',
    [usuarioId],
  );
  if (!rows[0] || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    // 400 y no 401: con un 401 el frontend cerraría la sesión
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }

  await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [
    await hashearPassword(nueva),
    usuarioId,
  ]);
}
