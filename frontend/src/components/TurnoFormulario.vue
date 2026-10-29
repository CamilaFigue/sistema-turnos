<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import type { Servicio } from '@/api/servicios'
import type { DatosTurno } from '@/api/turnos'
import { hoy } from '@/utils/fechas'

const props = defineProps<{
  profesionales: Profesional[]
  servicios: Servicio[]
  fechaInicial: string
  profesionalInicial: number | null
  guardando: boolean
}>()

const emit = defineEmits<{
  guardar: [datos: DatosTurno]
  cancelar: []
}>()

// Solo se le pueden dar turnos a profesionales activos
const profesionalesActivos = computed(() => props.profesionales.filter((p) => p.activo))

const formulario = reactive({
  profesional_id: props.profesionalInicial ?? profesionalesActivos.value[0]?.id ?? null,
  servicio_id: null as number | null,
  fecha: props.fechaInicial,
  hora: '',
  nombre: '',
  telefono: '',
  email: '',
  notas: '',
})

// Servicios que hace el profesional elegido y que siguen activos
const serviciosDelProfesional = computed(() => {
  const profesional = props.profesionales.find((p) => p.id === formulario.profesional_id)
  const ids = profesional?.servicios.map((s) => s.id) ?? []
  return props.servicios.filter((s) => s.activo && ids.includes(s.id))
})

const horariosLibres = ref<string[]>([])
const buscandoHorarios = ref(false)
const errorHorarios = ref('')

async function buscarHorarios() {
  formulario.hora = ''
  horariosLibres.value = []
  errorHorarios.value = ''
  if (formulario.profesional_id === null || formulario.servicio_id === null || !formulario.fecha) {
    return
  }

  buscandoHorarios.value = true
  try {
    horariosLibres.value = await profesionalesApi.disponibilidad(
      formulario.profesional_id,
      formulario.fecha,
      formulario.servicio_id,
    )
  } catch (e) {
    errorHorarios.value = (e as Error).message
  } finally {
    buscandoHorarios.value = false
  }
}

// Al cambiar de profesional, el servicio elegido puede no corresponderle: lo reseteamos
watch(
  () => formulario.profesional_id,
  () => {
    const sigueDisponible = serviciosDelProfesional.value.some(
      (s) => s.id === formulario.servicio_id,
    )
    if (!sigueDisponible) {
      formulario.servicio_id = serviciosDelProfesional.value[0]?.id ?? null
    }
  },
  { immediate: true },
)

// watch: cada vez que cambia el profesional, el servicio o la fecha, buscamos los horarios libres
watch(() => [formulario.profesional_id, formulario.servicio_id, formulario.fecha], buscarHorarios, {
  immediate: true,
})

function enviar() {
  if (formulario.profesional_id === null || formulario.servicio_id === null) return
  emit('guardar', {
    profesional_id: formulario.profesional_id,
    servicio_id: formulario.servicio_id,
    fecha: formulario.fecha,
    hora: formulario.hora,
    notas: formulario.notas.trim() || null,
    cliente: {
      nombre: formulario.nombre.trim(),
      telefono: formulario.telefono.trim(),
      email: formulario.email.trim() || null,
    },
  })
}

// El padre lo llama si la reserva falla porque alguien ganó el horario
defineExpose({ buscarHorarios })
</script>

<template>
  <form class="tarjeta" @submit.prevent="enviar">
    <h2>Nuevo turno</h2>

    <div class="fila">
      <div class="campo">
        <label for="profesional">Profesional</label>
        <select id="profesional" v-model="formulario.profesional_id" required>
          <option v-for="p in profesionalesActivos" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select>
      </div>

      <div class="campo">
        <label for="servicio">Servicio</label>
        <select id="servicio" v-model="formulario.servicio_id" required>
          <option v-for="s in serviciosDelProfesional" :key="s.id" :value="s.id">
            {{ s.nombre }} ({{ s.duracion_minutos }} min)
          </option>
        </select>
      </div>

      <div class="campo">
        <label for="fecha">Fecha</label>
        <input id="fecha" v-model="formulario.fecha" type="date" :min="hoy()" required />
      </div>
    </div>

    <div class="campo">
      <span class="etiqueta-campo">Horario</span>
      <p v-if="serviciosDelProfesional.length === 0" class="texto-suave">
        Este profesional no tiene servicios activos asignados.
      </p>
      <p v-else-if="buscandoHorarios" class="texto-suave">Buscando horarios libres...</p>
      <p v-else-if="errorHorarios" class="alerta-error">{{ errorHorarios }}</p>
      <p v-else-if="horariosLibres.length === 0" class="texto-suave">
        No hay horarios libres ese día. Probá con otra fecha.
      </p>
      <div v-else class="horarios" role="radiogroup" aria-label="Horarios libres">
        <!-- Cada horario es un botón; el elegido queda resaltado -->
        <button
          v-for="hora in horariosLibres"
          :key="hora"
          type="button"
          role="radio"
          :aria-checked="formulario.hora === hora"
          :class="['boton', 'horario', { elegido: formulario.hora === hora }]"
          @click="formulario.hora = hora"
        >
          {{ hora }}
        </button>
      </div>
    </div>

    <div class="fila">
      <div class="campo">
        <label for="nombre">Nombre del paciente</label>
        <input id="nombre" v-model="formulario.nombre" required maxlength="100" />
      </div>
      <div class="campo">
        <label for="telefono">Teléfono</label>
        <input id="telefono" v-model="formulario.telefono" type="tel" required />
      </div>
      <div class="campo">
        <label for="email">Email (opcional)</label>
        <input id="email" v-model="formulario.email" type="email" />
      </div>
    </div>

    <div class="campo">
      <label for="notas">Notas (opcional)</label>
      <textarea id="notas" v-model="formulario.notas" rows="2" />
    </div>

    <div class="acciones">
      <button type="button" class="boton" @click="emit('cancelar')">Cancelar</button>
      <button
        type="submit"
        class="boton boton-primario"
        :disabled="guardando || formulario.hora === ''"
      >
        {{ guardando ? 'Reservando...' : 'Reservar turno' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

.fila {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0 1rem;
}

.etiqueta-campo {
  font-size: 0.9rem;
  font-weight: 600;
}

.horarios {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.horario {
  min-width: 4.5rem;
}

.horario.elegido {
  background: var(--color-primario);
  border-color: var(--color-primario);
  color: #fff;
}
</style>
