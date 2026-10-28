<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { horariosApi, type DatosHorario, type Horario } from '@/api/horarios'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import HorarioDia, { type FranjaEditable } from '@/components/HorarioDia.vue'

// Un día de la semana con sus franjas, tal como se edita en pantalla
interface DiaEditable {
  dia_semana: number
  nombre: string
  franjas: FranjaEditable[]
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
// La semana se muestra de lunes a domingo (dia_semana: 1, 2, ..., 6, 0)
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

const route = useRoute()
const router = useRouter()

const profesionales = ref<Profesional[]>([])
const profesionalId = ref<number | null>(null)

const semana = ref<DiaEditable[]>([])
// Lo último que se cargó o se guardó, para saber si hay cambios sin guardar
const guardado = ref<DatosHorario[]>([])

const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const mensaje = ref('')

// De lo que devuelve la API (una lista plana de franjas) a una lista de días
function aSemana(horarios: Horario[]): DiaEditable[] {
  return ORDEN_SEMANA.map((dia) => ({
    dia_semana: dia,
    nombre: DIAS[dia] ?? '',
    franjas: horarios
      .filter((h) => h.dia_semana === dia)
      .map((h) => ({ clave: h.id, hora_inicio: h.hora_inicio, hora_fin: h.hora_fin })),
  }))
}

// De la lista de días a lo que espera la API (una lista plana de franjas)
function aDatos(dias: DiaEditable[]): DatosHorario[] {
  return dias.flatMap((d) =>
    d.franjas.map((f) => ({
      dia_semana: d.dia_semana,
      hora_inicio: f.hora_inicio,
      hora_fin: f.hora_fin,
    })),
  )
}

// Comparamos como texto: si son iguales, no hay nada nuevo para guardar
const hayCambios = computed(
  () => JSON.stringify(aDatos(semana.value)) !== JSON.stringify(guardado.value),
)

function mostrar(horarios: Horario[]) {
  semana.value = aSemana(horarios)
  guardado.value = aDatos(semana.value)
}

async function cargarHorarios() {
  if (profesionalId.value === null) return
  cargando.value = true
  error.value = ''
  mensaje.value = ''
  try {
    mostrar(await horariosApi.listar(profesionalId.value))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

function confirmarDescarte(): boolean {
  return !hayCambios.value || confirm('Hay cambios sin guardar. ¿Querés descartarlos?')
}

function cambiarProfesional(evento: Event) {
  const select = evento.target as HTMLSelectElement
  if (!confirmarDescarte()) {
    // Volvemos el select al profesional que estaba elegido
    select.value = String(profesionalId.value)
    return
  }
  profesionalId.value = Number(select.value)
  // Actualizamos la URL: si se recarga la página, sigue mostrando el mismo profesional
  router.replace({ query: { profesional: profesionalId.value } })
  cargarHorarios()
}

// Validación rápida antes de llamar a la API, con un mensaje que nombra el día
function validar(): string | null {
  for (const dia of semana.value) {
    for (const f of dia.franjas) {
      if (f.hora_fin <= f.hora_inicio) {
        return `${dia.nombre}: la franja de ${f.hora_inicio} a ${f.hora_fin} termina antes de empezar`
      }
    }
  }
  return null
}

async function guardar() {
  if (profesionalId.value === null) return
  error.value = ''
  mensaje.value = ''

  const problema = validar()
  if (problema) {
    error.value = problema
    return
  }

  guardando.value = true
  try {
    mostrar(await horariosApi.reemplazar(profesionalId.value, aDatos(semana.value)))
    mensaje.value = 'Horarios guardados'
  } catch (e) {
    // Por ejemplo, franjas que se pisan: el backend responde con el día y las horas
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}

function descartar() {
  if (confirmarDescarte()) {
    cargarHorarios()
  }
}

// Si quiere ir a otra pantalla con cambios sin guardar, le preguntamos antes
onBeforeRouteLeave(() => confirmarDescarte())

onMounted(async () => {
  try {
    profesionales.value = await profesionalesApi.listar()
  } catch (e) {
    error.value = (e as Error).message
    cargando.value = false
    return
  }

  // Si se llegó con /horarios?profesional=2 (desde Profesionales), elegimos ese
  const desdeUrl = Number(route.query.profesional)
  const elegido = profesionales.value.find((p) => p.id === desdeUrl) ?? profesionales.value[0]
  profesionalId.value = elegido?.id ?? null

  if (profesionalId.value === null) {
    cargando.value = false
  } else {
    await cargarHorarios()
  }
})
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Horarios de atención</h1>
      <div v-if="profesionales.length > 0" class="campo selector">
        <label for="profesional">Profesional</label>
        <select id="profesional" :value="profesionalId" @change="cambiarProfesional">
          <option v-for="p in profesionales" :key="p.id" :value="p.id">
            {{ p.nombre }}{{ p.activo ? '' : ' (inactivo)' }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="error" class="alerta-error">{{ error }}</p>
    <p v-if="mensaje" class="alerta-exito">{{ mensaje }}</p>

    <p v-if="cargando" class="texto-suave">Cargando...</p>
    <p v-else-if="profesionalId === null && !error" class="texto-suave">
      Primero cargá un profesional en la pantalla de Profesionales.
    </p>

    <form v-else-if="profesionalId !== null" class="tarjeta" @submit.prevent="guardar">
      <!-- v-model en un componente propio: HorarioDia recibe y modifica las franjas del día -->
      <HorarioDia
        v-for="dia in semana"
        :key="dia.dia_semana"
        v-model="dia.franjas"
        :nombre="dia.nombre"
      />

      <div class="acciones pie">
        <span v-if="hayCambios" class="texto-suave">Hay cambios sin guardar</span>
        <button type="button" class="boton" :disabled="!hayCambios" @click="descartar">
          Descartar cambios
        </button>
        <button type="submit" class="boton boton-primario" :disabled="!hayCambios || guardando">
          {{ guardando ? 'Guardando...' : 'Guardar horarios' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.selector {
  margin-bottom: 0;
  min-width: 240px;
}

.pie {
  align-items: center;
  padding-top: 1rem;
}

.alerta-exito {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  padding: 0.75rem 1rem;
  border-radius: var(--radio);
  margin-bottom: 1rem;
}
</style>
