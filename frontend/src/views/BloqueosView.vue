<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { bloqueosApi, type Bloqueo, type TurnoAfectado } from '@/api/bloqueos'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import { useAuthStore } from '@/stores/auth'
import { formatoLargo, hoy } from '@/utils/fechas'

// El admin bloquea días de cualquier profesional; un profesional, solo los suyos
const auth = useAuthStore()

const bloqueos = ref<Bloqueo[]>([])
const profesionales = ref<Profesional[]>([])
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')

const formulario = reactive({
  profesional_id: null as number | null,
  desde: hoy(),
  hasta: hoy(),
  motivo: '',
})

// Resultado del último bloqueo: qué turnos se cancelaron, para avisar a esos clientes
const ultimoBloqueo = ref<Bloqueo | null>(null)
const turnosCancelados = ref<TurnoAfectado[]>([])

// "Lunes, 20 de diciembre" o "Lunes, 20 de diciembre al martes, 5 de enero"
function rango(b: { desde: string; hasta: string }): string {
  return b.desde === b.hasta
    ? formatoLargo(b.desde)
    : `${formatoLargo(b.desde)} al ${formatoLargo(b.hasta).toLowerCase()}`
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    if (auth.esAdmin) {
      const [listaBloqueos, listaProfesionales] = await Promise.all([
        bloqueosApi.listar(),
        profesionalesApi.listar(),
      ])
      bloqueos.value = listaBloqueos
      profesionales.value = listaProfesionales.filter((p) => p.activo)
    } else {
      bloqueos.value = await bloqueosApi.listar()
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

// Si cambian "desde" y queda después de "hasta", movemos "hasta" para que el rango tenga sentido
function cambiarDesde() {
  if (formulario.hasta < formulario.desde) formulario.hasta = formulario.desde
}

async function bloquear() {
  const aviso =
    'Los turnos confirmados de esos días se van a cancelar y esos horarios dejan de ofrecerse. ¿Seguir?'
  if (!confirm(aviso)) return

  guardando.value = true
  error.value = ''
  try {
    const resultado = await bloqueosApi.crear({
      profesional_id: auth.esAdmin ? formulario.profesional_id : null,
      desde: formulario.desde,
      hasta: formulario.hasta,
      motivo: formulario.motivo.trim() || null,
    })
    ultimoBloqueo.value = resultado.bloqueo
    turnosCancelados.value = resultado.turnos_cancelados
    formulario.motivo = ''
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}

async function quitar(bloqueo: Bloqueo) {
  if (!confirm(`¿Quitar el bloqueo del ${rango(bloqueo)}? Esos días se vuelven a ofrecer.`)) return
  error.value = ''
  try {
    await bloqueosApi.eliminar(bloqueo.id)
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  }
}

onMounted(cargar)
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Días bloqueados</h1>
    </div>
    <p class="texto-suave intro">
      Francos, vacaciones o días sin atención. Esos días no se pueden reservar y los turnos que ya
      había se cancelan.
    </p>

    <p v-if="error" class="alerta-error">{{ error }}</p>

    <!-- Resultado del bloqueo recién creado -->
    <div v-if="ultimoBloqueo" class="tarjeta resultado">
      <p class="alerta-exito">
        Bloqueado: {{ rango(ultimoBloqueo) }}
        <template v-if="auth.esAdmin"> · {{ ultimoBloqueo.profesional.nombre }}</template>
      </p>
      <template v-if="turnosCancelados.length > 0">
        <p>
          Se
          {{
            turnosCancelados.length === 1
              ? 'canceló 1 turno'
              : `cancelaron ${turnosCancelados.length} turnos`
          }}. Avisales a estos clientes:
        </p>
        <ul class="afectados">
          <li v-for="t in turnosCancelados" :key="t.id">
            <strong>{{ t.cliente.nombre }}</strong> · {{ t.cliente.telefono }}
            <span class="texto-suave">
              — {{ formatoLargo(t.fecha) }} {{ t.hora_inicio }}, {{ t.servicio }}
            </span>
          </li>
        </ul>
      </template>
      <p v-else class="texto-suave">No había turnos para cancelar en esos días.</p>
      <button class="boton" @click="ultimoBloqueo = null">Cerrar</button>
    </div>

    <form class="tarjeta formulario" @submit.prevent="bloquear">
      <h2>Bloquear días</h2>

      <div v-if="auth.esAdmin" class="campo">
        <label for="profesional">Profesional</label>
        <select id="profesional" v-model="formulario.profesional_id" required>
          <option :value="null" disabled>Elegí un profesional</option>
          <option v-for="p in profesionales" :key="p.id" :value="p.id">{{ p.nombre }}</option>
        </select>
      </div>

      <div class="fechas">
        <div class="campo">
          <label for="desde">Desde</label>
          <input
            id="desde"
            v-model="formulario.desde"
            type="date"
            :min="hoy()"
            required
            @change="cambiarDesde"
          />
        </div>
        <div class="campo">
          <label for="hasta">Hasta (incluido)</label>
          <input
            id="hasta"
            v-model="formulario.hasta"
            type="date"
            :min="formulario.desde"
            required
          />
        </div>
      </div>

      <div class="campo">
        <label for="motivo">Motivo (opcional)</label>
        <input id="motivo" v-model="formulario.motivo" maxlength="200" placeholder="Vacaciones" />
      </div>

      <div class="acciones">
        <button type="submit" class="boton boton-primario" :disabled="guardando">
          {{ guardando ? 'Bloqueando...' : 'Bloquear' }}
        </button>
      </div>
    </form>

    <h2 class="subtitulo">Próximos bloqueos</h2>
    <p v-if="cargando" class="texto-suave">Cargando...</p>
    <table v-else-if="bloqueos.length > 0" class="tabla">
      <thead>
        <tr>
          <th v-if="auth.esAdmin">Profesional</th>
          <th>Días</th>
          <th>Motivo</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in bloqueos" :key="b.id">
          <td v-if="auth.esAdmin">
            <strong>{{ b.profesional.nombre }}</strong>
          </td>
          <td>{{ rango(b) }}</td>
          <td>
            <span v-if="b.motivo">{{ b.motivo }}</span>
            <span v-else class="texto-suave">—</span>
          </td>
          <td>
            <div class="acciones">
              <button class="boton boton-peligro" @click="quitar(b)">Quitar</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else-if="!error" class="texto-suave">No hay días bloqueados.</p>
  </section>
</template>

<style scoped>
.intro {
  margin-bottom: 1rem;
}

.formulario,
.resultado {
  margin-bottom: 1.5rem;
  max-width: 600px;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.fechas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1rem;
}

.afectados {
  margin: 0.5rem 0 1rem;
  padding-left: 1.2rem;
}

.afectados li {
  margin-bottom: 0.3rem;
}

.subtitulo {
  margin-top: 0.5rem;
}

@media (max-width: 500px) {
  .fechas {
    grid-template-columns: 1fr;
  }
}
</style>
