<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/http'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import { serviciosApi, type Servicio } from '@/api/servicios'
import { turnosApi, type DatosTurno, type EstadoTurno, type Turno } from '@/api/turnos'
import TurnoFormulario from '@/components/TurnoFormulario.vue'
import { esFechaValida, formatoLargo, hoy, sumarDias } from '@/utils/fechas'

// Qué acciones se ofrecen según el estado (las mismas transiciones que valida el backend)
const ACCIONES: Record<EstadoTurno, { estado: EstadoTurno; texto: string }[]> = {
  pendiente: [
    { estado: 'confirmado', texto: 'Confirmar' },
    { estado: 'cancelado', texto: 'Cancelar' },
  ],
  confirmado: [
    { estado: 'completado', texto: 'Completar' },
    { estado: 'cancelado', texto: 'Cancelar' },
  ],
  cancelado: [],
  completado: [],
}

const NOMBRE_ESTADO: Record<EstadoTurno, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

const route = useRoute()
const router = useRouter()

// La fecha y el profesional viven en la URL (/agenda?fecha=2026-11-02&profesional=1):
// así se pueden recargar, compartir o volver atrás con el navegador
const fecha = computed(() => (esFechaValida(route.query.fecha) ? route.query.fecha : hoy()))
const profesionalId = computed(() => {
  const id = Number(route.query.profesional)
  return Number.isInteger(id) && id > 0 ? id : null
})

const turnos = ref<Turno[]>([])
const profesionales = ref<Profesional[]>([])
const servicios = ref<Servicio[]>([])
const cargando = ref(true)
const error = ref('')

const formularioAbierto = ref(false)
const guardando = ref(false)
// Referencia al componente del formulario, para pedirle que vuelva a buscar horarios
const formulario = useTemplateRef<InstanceType<typeof TurnoFormulario>>('formulario')

// Cuántos turnos hay de cada estado, para el resumen del día
const resumen = computed(() => {
  const cuenta: Record<EstadoTurno, number> = {
    pendiente: 0,
    confirmado: 0,
    completado: 0,
    cancelado: 0,
  }
  for (const t of turnos.value) cuenta[t.estado]++
  return cuenta
})

function irA(cambios: { fecha?: string; profesional?: number | null }) {
  const nuevaFecha = cambios.fecha ?? fecha.value
  const nuevoProfesional =
    cambios.profesional === undefined ? profesionalId.value : cambios.profesional
  router.push({
    query: {
      fecha: nuevaFecha,
      ...(nuevoProfesional === null ? {} : { profesional: nuevoProfesional }),
    },
  })
}

function elegirProfesional(evento: Event) {
  const valor = (evento.target as HTMLSelectElement).value
  irA({ profesional: valor === '' ? null : Number(valor) })
}

async function cargarTurnos() {
  cargando.value = true
  error.value = ''
  try {
    turnos.value = await turnosApi.listar(fecha.value, profesionalId.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

async function cambiarEstado(turno: Turno, estado: EstadoTurno) {
  if (
    estado === 'cancelado' &&
    !confirm(`¿Cancelar el turno de ${turno.cliente.nombre} a las ${turno.hora_inicio}?`)
  ) {
    return
  }
  error.value = ''
  try {
    const actualizado = await turnosApi.cambiarEstado(turno.id, estado)
    // Reemplazamos solo ese turno en la lista, sin volver a pedir toda la agenda
    turnos.value = turnos.value.map((t) => (t.id === actualizado.id ? actualizado : t))
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function reservar(datos: DatosTurno) {
  guardando.value = true
  error.value = ''
  try {
    const turno = await turnosApi.crear(datos)
    formularioAbierto.value = false
    // Mostramos el día (y el profesional, si había filtro) del turno recién creado
    const destino = {
      fecha: turno.fecha,
      profesional: profesionalId.value === null ? null : turno.profesional.id,
    }
    if (destino.fecha === fecha.value && destino.profesional === profesionalId.value) {
      await cargarTurnos() // misma vista: la URL no cambia, recargamos a mano
    } else {
      irA(destino) // cambia la URL y el watch recarga solo
    }
  } catch (e) {
    error.value = (e as Error).message
    // 409: alguien reservó ese horario mientras tanto. Actualizamos los horarios libres.
    if (e instanceof ApiError && e.status === 409) {
      formulario.value?.buscarHorarios()
    }
  } finally {
    guardando.value = false
  }
}

// Cada vez que cambia la URL (fecha o profesional), recargamos la agenda
watch([fecha, profesionalId], cargarTurnos)

onMounted(async () => {
  try {
    ;[profesionales.value, servicios.value] = await Promise.all([
      profesionalesApi.listar(),
      serviciosApi.listar(),
    ])
  } catch (e) {
    error.value = (e as Error).message
  }
  await cargarTurnos()
})
</script>

<template>
  <section>
    <div class="encabezado">
      <div>
        <h1>Agenda</h1>
        <p class="fecha-larga">{{ formatoLargo(fecha) }}</p>
      </div>
      <button
        v-if="!formularioAbierto"
        class="boton boton-primario"
        @click="formularioAbierto = true"
      >
        Nuevo turno
      </button>
    </div>

    <div class="filtros">
      <div class="navegacion" role="group" aria-label="Cambiar de día">
        <button
          class="boton"
          aria-label="Día anterior"
          @click="irA({ fecha: sumarDias(fecha, -1) })"
        >
          ‹
        </button>
        <button class="boton" :disabled="fecha === hoy()" @click="irA({ fecha: hoy() })">
          Hoy
        </button>
        <button
          class="boton"
          aria-label="Día siguiente"
          @click="irA({ fecha: sumarDias(fecha, 1) })"
        >
          ›
        </button>
        <input
          type="date"
          :value="fecha"
          aria-label="Elegir fecha"
          @change="irA({ fecha: ($event.target as HTMLInputElement).value || hoy() })"
        />
      </div>

      <select :value="profesionalId ?? ''" aria-label="Profesional" @change="elegirProfesional">
        <option value="">Todos los profesionales</option>
        <option v-for="p in profesionales" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>
    </div>

    <p v-if="error" class="alerta-error">{{ error }}</p>

    <TurnoFormulario
      v-if="formularioAbierto"
      ref="formulario"
      :profesionales="profesionales"
      :servicios="servicios"
      :fecha-inicial="fecha < hoy() ? hoy() : fecha"
      :profesional-inicial="profesionalId"
      :guardando="guardando"
      class="formulario"
      @guardar="reservar"
      @cancelar="formularioAbierto = false"
    />

    <p v-if="turnos.length > 0" class="resumen texto-suave">
      {{ turnos.length }} {{ turnos.length === 1 ? 'turno' : 'turnos' }}:
      {{ resumen.pendiente }} pendientes · {{ resumen.confirmado }} confirmados ·
      {{ resumen.completado }} completados · {{ resumen.cancelado }} cancelados
    </p>

    <p v-if="cargando" class="texto-suave">Cargando...</p>
    <ul v-else-if="turnos.length > 0" class="turnos">
      <li v-for="turno in turnos" :key="turno.id" :class="['turno', `turno-${turno.estado}`]">
        <div class="hora">
          <strong>{{ turno.hora_inicio }}</strong>
          <span class="texto-suave">{{ turno.hora_fin }}</span>
        </div>

        <div class="detalle">
          <p>
            <strong>{{ turno.cliente.nombre }}</strong>
            <span class="texto-suave"> · {{ turno.cliente.telefono }}</span>
          </p>
          <p class="texto-suave">
            {{ turno.servicio.nombre }}
            <template v-if="profesionalId === null"> · {{ turno.profesional.nombre }}</template>
          </p>
          <p v-if="turno.notas" class="notas">{{ turno.notas }}</p>
        </div>

        <span :class="['etiqueta', `estado-${turno.estado}`]">
          {{ NOMBRE_ESTADO[turno.estado] }}
        </span>

        <div class="acciones">
          <button
            v-for="accion in ACCIONES[turno.estado]"
            :key="accion.estado"
            :class="['boton', { 'boton-peligro': accion.estado === 'cancelado' }]"
            @click="cambiarEstado(turno, accion.estado)"
          >
            {{ accion.texto }}
          </button>
        </div>
      </li>
    </ul>
    <p v-else-if="!error" class="tarjeta texto-suave vacio">No hay turnos para este día.</p>
  </section>
</template>

<style scoped>
.encabezado {
  align-items: flex-start;
}

.fecha-larga {
  color: var(--color-texto-suave);
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.navegacion {
  display: flex;
  gap: 0.4rem;
}

.filtros input,
.filtros select {
  font: inherit;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  background: var(--color-superficie);
}

.formulario {
  margin-bottom: 1.5rem;
}

.resumen {
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.turnos {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.turno {
  display: grid;
  grid-template-columns: 70px 1fr auto auto;
  align-items: center;
  gap: 1rem;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-left: 4px solid var(--color-borde);
  border-radius: var(--radio);
  padding: 0.75rem 1rem;
}

.turno-pendiente {
  border-left-color: #f59e0b;
}

.turno-confirmado {
  border-left-color: var(--color-primario);
}

.turno-completado {
  border-left-color: #64748b;
}

.turno-cancelado {
  opacity: 0.6;
}

.turno-cancelado .detalle strong {
  text-decoration: line-through;
}

.hora {
  display: flex;
  flex-direction: column;
}

.notas {
  font-size: 0.9rem;
  font-style: italic;
}

.estado-pendiente {
  background: #fef3c7;
  color: #92400e;
}

.estado-confirmado {
  background: #ccfbf1;
  color: #115e59;
}

.estado-completado {
  background: #e2e8f0;
  color: #334155;
}

.estado-cancelado {
  background: #fee2e2;
  color: #991b1b;
}

.vacio {
  text-align: center;
}

@media (max-width: 700px) {
  .turno {
    grid-template-columns: 60px 1fr;
  }

  .turno .acciones {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}
</style>
