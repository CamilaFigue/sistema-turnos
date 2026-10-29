<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const formulario = reactive({ email: '', password: '' })
const enviando = ref(false)
const error = ref('')

async function entrar() {
  enviando.value = true
  error.value = ''
  try {
    await auth.iniciarSesion(formulario.email.trim(), formulario.password)
    // Volvemos a la pantalla que quería ver antes de que le pidiéramos iniciar sesión.
    // Solo aceptamos rutas internas ("/agenda"), nunca una dirección de otro sitio.
    const volver = route.query.volver
    const destino =
      typeof volver === 'string' && volver.startsWith('/') && !volver.startsWith('//')
        ? volver
        : '/'
    router.replace(destino)
  } catch (e) {
    error.value = (e as Error).message
    formulario.password = ''
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="pantalla">
    <form class="tarjeta caja" @submit.prevent="entrar">
      <h1>Consultorio Salud Integral</h1>
      <p class="texto-suave subtitulo">Iniciá sesión para administrar tu agenda</p>

      <p v-if="error" class="alerta-error" role="alert">{{ error }}</p>

      <div class="campo">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="formulario.email"
          type="email"
          autocomplete="username"
          required
          autofocus
        />
      </div>

      <div class="campo">
        <label for="password">Contraseña</label>
        <input
          id="password"
          v-model="formulario.password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <button type="submit" class="boton boton-primario entrar" :disabled="enviando">
        {{ enviando ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.pantalla {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.caja {
  width: 100%;
  max-width: 380px;
}

h1 {
  color: var(--color-primario);
}

.subtitulo {
  margin-bottom: 1.5rem;
}

.entrar {
  width: 100%;
  padding: 0.6rem;
}
</style>
