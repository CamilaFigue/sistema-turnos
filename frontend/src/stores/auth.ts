import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, type UsuarioSesion } from '@/api/auth'
import { ApiError, usarToken } from '@/api/http'

const CLAVE_TOKEN = 'turnos_token'

// Leer o escribir localStorage puede fallar (por ejemplo, en modo privado): no rompemos la app
function leerTokenGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

function guardarToken(token: string | null) {
  try {
    if (token === null) localStorage.removeItem(CLAVE_TOKEN)
    else localStorage.setItem(CLAVE_TOKEN, token)
  } catch {
    // Sin localStorage la sesión dura hasta recargar la página
  }
}

// Store de Pinia: estado compartido por toda la app (cualquier pantalla puede usarlo)
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(leerTokenGuardado())
  const usuario = ref<UsuarioSesion | null>(null)

  const estaLogueado = computed(() => token.value !== null)

  // Al crear el store, si había un token guardado, la API ya lo empieza a usar
  usarToken(token.value)

  function guardarSesion(nuevoToken: string | null, nuevoUsuario: UsuarioSesion | null) {
    token.value = nuevoToken
    usuario.value = nuevoUsuario
    usarToken(nuevoToken)
    guardarToken(nuevoToken)
  }

  async function iniciarSesion(email: string, password: string) {
    const sesion = await authApi.login(email, password)
    guardarSesion(sesion.token, sesion.usuario)
  }

  function cerrarSesion() {
    guardarSesion(null, null)
  }

  // Al recargar la página tenemos el token pero no los datos del usuario: los pedimos.
  // Si el token ya no sirve (401), se cierra la sesión. Si el servidor no responde,
  // la mantenemos: no queremos sacar al usuario por un corte momentáneo.
  async function cargarUsuario() {
    if (!token.value || usuario.value) return
    try {
      usuario.value = await authApi.yo()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) cerrarSesion()
    }
  }

  return { token, usuario, estaLogueado, iniciarSesion, cerrarSesion, cargarUsuario }
})
