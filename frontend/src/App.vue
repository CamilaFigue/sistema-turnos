<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="layout">
    <aside class="menu">
      <p class="marca">Turnos</p>
      <nav>
        <RouterLink to="/agenda">Agenda</RouterLink>
        <RouterLink to="/profesionales">Profesionales</RouterLink>
        <RouterLink to="/horarios">Horarios</RouterLink>
        <RouterLink to="/servicios">Servicios</RouterLink>
      </nav>
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

  .contenido {
    padding: 1rem;
  }
}
</style>
