<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { publicoApi, type NegocioPublico, type TurnoPublico } from '@/api/publico'
import { formatoLargo } from '@/utils/fechas'

// Página que abre el paciente con su link: /reservar/:slug/cancelar/:codigo
// El código secreto de la URL reemplaza al login.
const route = useRoute()
const slug = String(route.params.slug)
const codigo = String(route.params.codigo)

const negocio = ref<NegocioPublico | null>(null)
const turno = ref<TurnoPublico | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const cancelando = ref(false)
const error = ref('')

async function cancelar() {
  if (!confirm('¿Seguro que querés cancelar el turno? El horario queda libre para otra persona.')) {
    return
  }
  cancelando.value = true
  error.value = ''
  try {
    turno.value = await publicoApi.cancelarTurno(slug, codigo)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cancelando.value = false
  }
}

onMounted(async () => {
  try {
    // Los dos pedidos salen a la vez: datos del consultorio y del turno
    ;[negocio.value, turno.value] = await Promise.all([
      publicoApi.negocio(slug),
      publicoApi.verTurno(slug, codigo),
    ])
  } catch (e) {
    errorCarga.value = (e as Error).message
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <main class="pagina">
    <p v-if="cargando" class="texto-suave centro">Cargando...</p>
    <p v-else-if="errorCarga" class="tarjeta centro">{{ errorCarga }}</p>

    <template v-else-if="negocio && turno">
      <header class="cabecera">
        <h1>{{ negocio.nombre }}</h1>
        <p v-if="negocio.telefono" class="texto-suave">Teléfono: {{ negocio.telefono }}</p>
      </header>

      <section class="tarjeta turno">
        <h2>Tu turno</h2>
        <p>
          <strong>{{ turno.servicio }}</strong> con {{ turno.profesional }}
        </p>
        <p :class="['cuando', { tachado: turno.estado === 'cancelado' }]">
          {{ formatoLargo(turno.fecha) }}, de {{ turno.hora_inicio }} a {{ turno.hora_fin }}
        </p>

        <p v-if="turno.estado === 'cancelado'" class="alerta-exito">Este turno está cancelado.</p>
        <p v-else-if="turno.estado === 'completado'" class="texto-suave">
          Este turno ya fue atendido.
        </p>

        <template v-else-if="turno.se_puede_cancelar">
          <p v-if="error" class="alerta-error" role="alert">{{ error }}</p>
          <button class="boton boton-peligro" :disabled="cancelando" @click="cancelar">
            {{ cancelando ? 'Cancelando...' : 'Cancelar turno' }}
          </button>
        </template>

        <p v-else class="texto-suave">
          Falta poco para el turno y ya no se puede cancelar online.
          <template v-if="negocio.telefono">
            Si no podés asistir, llamá al {{ negocio.telefono }}.
          </template>
        </p>
      </section>

      <p class="centro">
        <RouterLink :to="`/reservar/${slug}`">Reservar otro turno</RouterLink>
      </p>
    </template>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 520px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
}

.centro {
  text-align: center;
}

.cabecera {
  text-align: center;
  margin-bottom: 1.5rem;
}

.cabecera h1 {
  color: var(--color-primario);
}

.turno {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.1rem;
}

.cuando {
  font-size: 1.1rem;
  font-weight: 600;
}

.tachado {
  text-decoration: line-through;
  color: var(--color-texto-suave);
}

a {
  color: var(--color-primario);
}
</style>
