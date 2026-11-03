import { rateLimit } from 'express-rate-limit';

// Límites de peticiones por IP. Frenan a quien intenta adivinar contraseñas
// o cargar reservas falsas en serie. Los contadores viven en memoria:
// si el servidor se reinicia, vuelven a cero (alcanza para una sola instancia).

const MINUTO = 60 * 1000;

// Opciones comunes: avisamos el límite con headers estándar y respondemos
// con el mismo formato de error que el resto de la API: { "error": "..." }
function crearLimite(minutos: number, maximo: number, mensaje: string, soloFallidos = false) {
  return rateLimit({
    windowMs: minutos * MINUTO,
    limit: maximo,
    skipSuccessfulRequests: soloFallidos,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: mensaje },
  });
}

// Login: 10 intentos fallidos cada 15 minutos. Los que salen bien no cuentan.
export const limiteLogin = crearLimite(
  15,
  10,
  'Demasiados intentos de inicio de sesión. Probá de nuevo en 15 minutos.',
  true,
);

// Reservas públicas: 10 por hora
export const limiteReservas = crearLimite(
  60,
  10,
  'Se hicieron demasiadas reservas desde esta conexión. Probá de nuevo en una hora.',
);

// Toda la API: 600 peticiones cada 15 minutos. Un uso normal del panel no llega,
// aunque varias personas del consultorio compartan la misma conexión.
export const limiteGeneral = crearLimite(
  15,
  600,
  'Demasiadas peticiones seguidas. Esperá unos minutos y volvé a intentar.',
);