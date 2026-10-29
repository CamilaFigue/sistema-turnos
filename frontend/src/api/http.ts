// Error que devuelve la API, con el mensaje que manda el backend ({ "error": "..." })
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Token de la sesión actual. Lo setea el store de autenticación al iniciar o cerrar sesión.
let token: string | null = null
// Qué hacer si el backend dice que la sesión no sirve más (lo configura main.ts)
let alExpirarSesion: () => void = () => {}

export function usarToken(nuevoToken: string | null) {
  token = nuevoToken
}

export function cuandoExpireLaSesion(accion: () => void) {
  alExpirarSesion = accion
}

// Hace una petición a la API y devuelve el JSON de la respuesta ya tipado.
// Si el backend responde con error, lanza un ApiError con su mensaje.
export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const conToken = token !== null
  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        // Si hay sesión, mandamos el token en cada petición
        ...(conToken ? { Authorization: `Bearer ${token}` } : {}),
        ...opciones.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
  }

  // 401 con token: la sesión venció o no es válida. Volvemos al login.
  // (Sin token, un 401 es el login rechazado y lo muestra la pantalla de login.)
  if (respuesta.status === 401 && conToken) {
    alExpirarSesion()
  }

  // 204 No Content: la operación salió bien pero no hay nada para leer
  if (respuesta.status === 204) {
    return undefined as T
  }

  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    // Sin JSON y con error 5xx: el backend no respondió (por ejemplo, está apagado)
    if (datos === null && respuesta.status >= 500) {
      throw new ApiError(respuesta.status, 'No se pudo conectar con el servidor')
    }
    throw new ApiError(respuesta.status, datos?.error ?? 'Ocurrió un error inesperado')
  }
  return datos as T
}

// Atajos para no repetir method y JSON.stringify en cada llamada
export const api = {
  get: <T>(ruta: string) => pedir<T>(ruta),
  post: <T>(ruta: string, body?: unknown) =>
    pedir<T>(ruta, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(ruta: string, body?: unknown) =>
    pedir<T>(ruta, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(ruta: string, body?: unknown) =>
    pedir<T>(ruta, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(ruta: string) => pedir<T>(ruta, { method: 'DELETE' }),
}
