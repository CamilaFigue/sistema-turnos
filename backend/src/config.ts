// Si falta algo obligatorio, el servidor no arranca:
// es mejor un error claro al iniciar que un login que falla "misteriosamente".

function obligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (revisá el archivo .env)`);
  }
  return valor;
}

export const config = {
  // Clave secreta con la que se firman los tokens. Si alguien la conoce, puede falsificarlos.
  jwtSecreto: obligatoria('JWT_SECRET'),
  // Cuánto dura una sesión antes de tener que volver a iniciar sesión
  jwtDuracion: process.env.JWT_DURACION || '8h',
};