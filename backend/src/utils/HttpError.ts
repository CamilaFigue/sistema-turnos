// Error con código HTTP: lo lanzamos desde cualquier capa y el
// errorHandler lo convierte en una respuesta JSON.
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}