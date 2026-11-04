<script setup lang="ts">
import { reactive, ref } from 'vue'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const formulario = reactive({ actual: '', nueva: '', repetida: '' })
const guardando = ref(false)
const error = ref('')
const mensaje = ref('')

async function cambiar() {
  error.value = ''
  mensaje.value = ''
  // Esto lo controlamos acá: el backend no sabe lo que escribiste en "repetir"
  if (formulario.nueva !== formulario.repetida) {
    error.value = 'Las contraseñas nuevas no coinciden'
    return
  }

  guardando.value = true
  try {
    await authApi.cambiarPassword(formulario.actual, formulario.nueva)
    mensaje.value = 'Contraseña cambiada. La próxima vez que inicies sesión, usá la nueva.'
    formulario.actual = ''
    formulario.nueva = ''
    formulario.repetida = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Mi cuenta</h1>
    </div>

    <div v-if="auth.usuario" class="tarjeta datos">
      <p>
        <strong>{{ auth.usuario.nombre }}</strong>
      </p>
      <p class="texto-suave">{{ auth.usuario.email }}</p>
      <p class="texto-suave">
        {{
          auth.esAdmin
            ? 'Administrador: gestionás todo el panel'
            : 'Profesional: ves tu agenda y bloqueás tus días'
        }}
      </p>
    </div>

    <form class="tarjeta formulario" @submit.prevent="cambiar">
      <h2>Cambiar contraseña</h2>

      <p v-if="error" class="alerta-error" role="alert">{{ error }}</p>
      <p v-if="mensaje" class="alerta-exito" role="status">{{ mensaje }}</p>

      <div class="campo">
        <label for="actual">Contraseña actual</label>
        <input
          id="actual"
          v-model="formulario.actual"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <div class="campo">
        <label for="nueva">Contraseña nueva (mínimo 8 caracteres)</label>
        <input
          id="nueva"
          v-model="formulario.nueva"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </div>
      <div class="campo">
        <label for="repetida">Repetí la contraseña nueva</label>
        <input
          id="repetida"
          v-model="formulario.repetida"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </div>

      <div class="acciones">
        <button type="submit" class="boton boton-primario" :disabled="guardando">
          {{ guardando ? 'Guardando...' : 'Cambiar contraseña' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.datos,
.formulario {
  max-width: 480px;
  margin-bottom: 1.5rem;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}
</style>
