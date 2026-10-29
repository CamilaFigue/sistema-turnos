// Ayudas para trabajar con fechas "AAAA-MM-DD", el formato que usa la API

// Fecha de hoy según el reloj de la computadora.
// No usamos toISOString() porque devuelve la fecha en UTC: a la noche en Argentina ya sería "mañana".
export function hoy(): string {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

// Suma (o resta, con números negativos) días a una fecha
export function sumarDias(fecha: string, dias: number): string {
  // Usamos el mediodía para que ningún cambio de horario mueva la fecha
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + dias)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// "2026-11-02" -> "Lunes, 2 de noviembre"
export function formatoLargo(fecha: string): string {
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fecha}T12:00:00`))
  // Intl devuelve "lunes, ...": pasamos solo la primera letra a mayúscula
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Valida que un texto sea una fecha AAAA-MM-DD real (para leerla de la URL)
export function esFechaValida(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(new Date(`${valor}T12:00:00`).getTime())
  )
}
