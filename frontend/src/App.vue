<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

function salir() {
  auth.cerrarSesion()
  router.push({ name: 'login' })
}
</script>

<template>
  <!-- Las pantallas públicas (como el login) se muestran solas, sin el menú -->
  <RouterView v-if="route.meta.publica" />

  <div v-else class="layout">
    <aside class="menu">
      <p class="marca">Turnos</p>
      <nav>
        <RouterLink to="/agenda">Agenda</RouterLink>
        <RouterLink to="/profesionales">Profesionales</RouterLink>
        <RouterLink to="/horarios">Horarios</RouterLink>
        <RouterLink to="/servicios">Servicios</RouterLink>
        <!-- target="_blank": la página de los pacientes se abre en otra pestaña -->
        <a
          v-if="auth.usuario"
          :href="`/reservar/${auth.usuario.negocio.slug}`"
          target="_blank"
          rel="noopener"
        >
          Página de reservas ↗
        </a>
      </nav>

      <div v-if="auth.usuario" class="sesion">
        <p class="usuario">{{ auth.usuario.nombre }}</p>
        <p class="negocio">{{ auth.usuario.negocio.nombre }}</p>
        <button class="salir" @click="salir">Cerrar sesión</button>
      </div>
    </aside>

    <main class="contenido">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
}

.menu {
  background: var(--color-menu);
  color: #fff;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
}

.marca {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  padding: 0 0.75rem;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

nav a {
  color: #cbd5e1;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radio);
}

nav a:hover {
  background: rgb(255 255 255 / 0.08);
}

/* RouterLink agrega esta clase al link de la página actual */
nav a.router-link-active {
  background: var(--color-primario);
  color: #fff;
}

/* margin-top: auto empuja la sesión al fondo del menú */
.sesion {
  margin-top: auto;
  padding: 1rem 0.75rem 0;
  border-top: 1px solid rgb(255 255 255 / 0.12);
}

.usuario {
  font-weight: 600;
}

.negocio {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.salir {
  font: inherit;
  font-size: 0.9rem;
  background: none;
  border: 1px solid rgb(255 255 255 / 0.25);
  color: #cbd5e1;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radio);
  cursor: pointer;
}

.salir:hover {
  background: rgb(255 255 255 / 0.08);
}

.contenido {
  padding: 2rem;
  max-width: 1100px;
  width: 100%;
}

/* En pantallas chicas, el menú pasa arriba */
@media (max-width: 700px) {
  .layout {
    /* minmax(0, 1fr): la columna nunca crece más que la pantalla por un contenido ancho */
    grid-template-columns: minmax(0, 1fr);
  }

  nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .sesion {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    margin-top: 1rem;
  }

  .negocio {
    margin-bottom: 0;
  }

  .contenido {
    padding: 1rem;
  }
}
</style>
