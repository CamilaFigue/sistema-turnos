<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ApiError } from '@/api/http'
import {
  publicoApi,
  type NegocioPublico,
  type ServicioPublico,
  type TurnoReservado,
} from '@/api/publico'
import { formatoLargo, hoy, sumarDias } from '@/utils/fechas'

// Cuántos días hacia adelante se pueden elegir
const DIAS_A_MOSTRAR = 14

const route = useRoute()
const slug = String(route.params.slug)

const negocio = ref<NegocioPublico | null>(null)
const cargando = ref(true)
const errorCarga = ref('')

// Lo que el paciente va eligiendo, paso a paso
const servicio = ref<ServicioPublico | null>(null)
const profesionalId = ref<number | null>(null)
const fecha = ref(hoy())
const hora = ref('')
const datos = reactive({ nombre: '', telefono: '', email: '', notas: '' })

const horariosLibres = ref<string[]>([])
const buscandoHorarios = ref(false)
const enviando = ref(false)
const error = ref('')
const reservado = ref<TurnoReservado | null>(null)

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'short' })

// Los próximos días como botones: { fecha: "2026-11-02", dia: "lun", numero: 2 }
const dias = computed(() =>
  Array.from({ length: DIAS_A_MOSTRAR }, (_, i) => {
    const valor = sumarDias(hoy(), i)
    const fechaLocal = new Date(`${valor}T12:00:00`)
    return {
      fecha: valor,
      dia: formatoDia.format(fechaLocal).replace('.', ''),
      numero: fechaLocal.getDate(),
    }
  }),
)

const profesionalElegido = computed(() =>
  servicio.value?.profesionales.find((p) => p.id === profesionalId.value),
)

function elegirServicio(s: ServicioPublico) {
  servicio.value = s
  // Si lo hace un solo profesional, lo elegimos directamente
  profesionalId.value = s.profesionales.length === 1 ? (s.profesionales[0]?.id ?? null) : null
}

async function buscarHorarios() {
  hora.value = ''
  horariosLibres.value = []
  if (!servicio.value || profesionalId.value === null) return

  buscandoHorarios.value = true
  try {
    horariosLibres.value = await publicoApi.disponibilidad(
      slug,
      profesionalId.value,
      servicio.value.id,
      fecha.value,
    )
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    buscandoHorarios.value = false
  }
}

// Cuando cambia algo de lo que dependen los horarios, los volvemos a buscar
watch([servicio, profesionalId, fecha], buscarHorarios)

function elegirHora(h: string) {
  hora.value = h
  error.value = ''
}

async function reservar() {
  if (!servicio.value || profesionalId.value === null || !hora.value) return
  enviando.value = true
  error.value = ''
  try {
    reservado.value = await publicoApi.reservar(slug, {
      profesional_id: profesionalId.value,
      servicio_id: servicio.value.id,
      fecha: fecha.value,
      hora: hora.value,
      notas: datos.notas.trim() || null,
      cliente: {
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        email: datos.email.trim() || null,
      },
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    error.value = (e as Error).message
    // Otra persona reservó ese horario mientras completaba sus datos
    if (e instanceof ApiError && e.status === 409) {
      await buscarHorarios()
      error.value = 'Alguien reservó ese horario recién. Elegí otro: tus datos quedan guardados.'
    }
  } finally {
    enviando.value = false
  }
}

function reservarOtro() {
  reservado.value = null
  servicio.value = null
  profesionalId.value = null
  fecha.value = hoy()
  datos.notas = ''
  // Nombre, teléfono y email quedan cargados: probablemente es la misma persona
}

onMounted(async () => {
  try {
    negocio.value = await publicoApi.negocio(slug)
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

    <template v-else-if="negocio">
      <header class="cabecera">
        <h1>{{ negocio.nombre }}</h1>
        <p v-if="negocio.direccion || negocio.telefono" class="texto-suave">
          {{ negocio.direccion }}
          <template v-if="negocio.direccion && negocio.telefono"> · </template>
          {{ negocio.telefono }}
        </p>
      </header>

      <!-- Confirmación -->
      <section v-if="reservado" class="tarjeta confirmacion" aria-live="polite">
        <p class="tilde" aria-hidden="true">✓</p>
        <h2>¡Turno reservado!</h2>
        <p>
          <strong>{{ reservado.servicio }}</strong> con {{ reservado.profesional }}
        </p>
        <p class="cuando">
          {{ formatoLargo(reservado.fecha) }}, de {{ reservado.hora_inicio }} a
          {{ reservado.hora_fin }}
        </p>
        <p class="texto-suave">Si no podés asistir, avisanos para liberar el horario.</p>
        <button class="boton" @click="reservarOtro">Reservar otro turno</button>
      </section>

      <form v-else class="pasos" @submit.prevent="reservar">
        <p v-if="negocio.servicios.length === 0" class="tarjeta">
          Por ahora no hay turnos disponibles para reservar online.
        </p>

        <!-- Paso 1: servicio -->
        <section v-else class="tarjeta">
          <h2><span class="numero">1</span> ¿Qué necesitás?</h2>
          <div class="opciones">
            <button
              v-for="s in negocio.servicios"
              :key="s.id"
              type="button"
              :class="['opcion', { elegida: servicio?.id === s.id }]"
              :aria-pressed="servicio?.id === s.id"
              @click="elegirServicio(s)"
            >
              <strong>{{ s.nombre }}</strong>
              <span class="texto-suave">
                {{ s.duracion_minutos }} min · {{ formatoPrecio.format(s.precio) }}
              </span>
            </button>
          </div>
        </section>

        <!-- Paso 2: profesional -->
        <section v-if="servicio" class="tarjeta">
          <h2><span class="numero">2</span> ¿Con quién?</h2>
          <p v-if="servicio.profesionales.length === 1">
            Te atiende <strong>{{ profesionalElegido?.nombre }}</strong>
          </p>
          <div v-else class="opciones">
            <button
              v-for="p in servicio.profesionales"
              :key="p.id"
              type="button"
              :class="['opcion', { elegida: profesionalId === p.id }]"
              :aria-pressed="profesionalId === p.id"
              @click="profesionalId = p.id"
            >
              <strong>{{ p.nombre }}</strong>
            </button>
          </div>
        </section>

        <!-- Paso 3: día y horario -->
        <section v-if="servicio && profesionalId !== null" class="tarjeta">
          <h2><span class="numero">3</span> ¿Cuándo?</h2>
          <div class="dias" role="radiogroup" aria-label="Día">
            <button
              v-for="d in dias"
              :key="d.fecha"
              type="button"
              role="radio"
              :aria-checked="fecha === d.fecha"
              :aria-label="formatoLargo(d.fecha)"
              :class="['dia', { elegida: fecha === d.fecha }]"
              @click="fecha = d.fecha"
            >
              <span class="dia-nombre">{{ d.dia }}</span>
              <span class="dia-numero">{{ d.numero }}</span>
            </button>
          </div>

          <p class="texto-suave fecha-elegida">{{ formatoLargo(fecha) }}</p>
          <p v-if="buscandoHorarios" class="texto-suave">Buscando horarios...</p>
          <p v-else-if="horariosLibres.length === 0" class="texto-suave">
            No hay horarios libres este día. Probá con otro.
          </p>
          <div v-else class="horarios" role="radiogroup" aria-label="Horario">
            <button
              v-for="h in horariosLibres"
              :key="h"
              type="button"
              role="radio"
              :aria-checked="hora === h"
              :class="['boton', 'horario', { elegida: hora === h }]"
              @click="elegirHora(h)"
            >
              {{ h }}
            </button>
          </div>
        </section>

        <!-- Paso 4: datos y confirmación -->
        <section v-if="hora" class="tarjeta">
          <h2><span class="numero">4</span> Tus datos</h2>

          <div class="campo">
            <label for="nombre">Nombre y apellido</label>
            <input
              id="nombre"
              v-model="datos.nombre"
              autocomplete="name"
              required
              maxlength="100"
            />
          </div>
          <div class="campo">
            <label for="telefono">Teléfono</label>
            <input id="telefono" v-model="datos.telefono" type="tel" autocomplete="tel" required />
          </div>
          <div class="campo">
            <label for="email">Email (opcional)</label>
            <input id="email" v-model="datos.email" type="email" autocomplete="email" />
          </div>
          <div class="campo">
            <label for="notas">¿Algo que debamos saber? (opcional)</label>
            <textarea id="notas" v-model="datos.notas" rows="2" />
          </div>

          <p class="resumen">
            <strong>{{ servicio?.nombre }}</strong> con {{ profesionalElegido?.nombre }}<br />
            {{ formatoLargo(fecha) }} a las {{ hora }}
          </p>

          <p v-if="error" class="alerta-error" role="alert">{{ error }}</p>

          <button type="submit" class="boton boton-primario confirmar" :disabled="enviando">
            {{ enviando ? 'Reservando...' : 'Confirmar turno' }}
          </button>
        </section>

        <p v-else-if="error" class="alerta-error" role="alert">{{ error }}</p>
      </form>
    </template>
  </main>
</template>

<style scoped>
.pagina {
  max-width: 640px;
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

.pasos {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.numero {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--color-primario);
  color: #fff;
  font-size: 0.85rem;
}

.opciones {
  display: grid;
  gap: 0.5rem;
}

.opcion {
  font: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.75rem 1rem;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  cursor: pointer;
}

.opcion:hover {
  border-color: var(--color-primario);
}

.opcion.elegida {
  border-color: var(--color-primario);
  outline: 2px solid var(--color-primario);
  outline-offset: -1px;
  background: #f0fdfa;
}

/* Fila de días que se desplaza hacia el costado */
.dias {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;
}

.dia {
  font: inherit;
  flex: 0 0 auto;
  width: 3.4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
  cursor: pointer;
}

.dia-nombre {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--color-texto-suave);
}

.dia-numero {
  font-size: 1.1rem;
  font-weight: 600;
}

.dia.elegida {
  background: var(--color-primario);
  border-color: var(--color-primario);
  color: #fff;
}

.dia.elegida .dia-nombre {
  color: #ccfbf1;
}

.fecha-elegida {
  margin: 0.75rem 0 0.5rem;
}

.horarios {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.horario {
  min-width: 4.5rem;
}

.horario.elegida {
  background: var(--color-primario);
  border-color: var(--color-primario);
  color: #fff;
}

.resumen {
  background: var(--color-fondo);
  border-radius: var(--radio);
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.confirmar {
  width: 100%;
  padding: 0.7rem;
}

.confirmacion {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.tilde {
  width: 3rem;
  height: 3rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dcfce7;
  color: #166534;
  font-size: 1.5rem;
  font-weight: 700;
}

.cuando {
  font-size: 1.1rem;
  font-weight: 600;
}
</style>
