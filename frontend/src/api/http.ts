// Error que devuelve la API, con el mensaje que manda el backend ({ "error": "..." })
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// Hace una petición a la API y devuelve el JSON de la respuesta ya tipado.
// Si el backend responde con error, lanza un ApiError con su mensaje.
export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      ...opciones,
      headers: { 'Content-Type': 'application/json', ...opciones.headers },
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor')
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
