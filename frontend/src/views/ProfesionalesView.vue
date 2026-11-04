<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import { serviciosApi, type Servicio } from '@/api/servicios'
import ProfesionalFormulario, {
  type FormularioProfesional,
} from '@/components/ProfesionalFormulario.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const profesionales = ref<Profesional[]>([])
const servicios = ref<Servicio[]>([])
const cargando = ref(true)
const error = ref('')

const formularioAbierto = ref(false)
const profesionalEditado = ref<Profesional | null>(null)
const guardando = ref(false)

// "Dar acceso": a qué profesional y con qué email y contraseña inicial
const profesionalAcceso = ref<Profesional | null>(null)
const acceso = reactive({ email: '', password: '' })
const mensaje = ref('')

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    // Promise.all: las dos consultas salen a la vez y esperamos a que terminen ambas
    const [listaProfesionales, listaServicios] = await Promise.all([
      profesionalesApi.listar(),
      serviciosApi.listar(),
    ])
    profesionales.value = listaProfesionales
    servicios.value = listaServicios
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

function abrirNuevo() {
  profesionalEditado.value = null
  formularioAbierto.value = true
}

function abrirEdicion(profesional: Profesional) {
  profesionalEditado.value = profesional
  formularioAbierto.value = true
}

function cerrarFormulario() {
  formularioAbierto.value = false
  profesionalEditado.value = null
}

async function guardar(datos: FormularioProfesional) {
  guardando.value = true
  error.value = ''
  try {
    // El usuario vinculado no se edita desde acá (se maneja con el login): conservamos el que tenía
    const datosProfesional = {
      nombre: datos.nombre,
      usuario_id: profesionalEditado.value?.usuario_id ?? null,
    }

    // Son dos llamadas: primero los datos del profesional, después sus servicios
    const profesional = profesionalEditado.value
      ? await profesionalesApi.actualizar(profesionalEditado.value.id, datosProfesional)
      : await profesionalesApi.crear(datosProfesional)
    await profesionalesApi.asignarServicios(profesional.id, datos.servicio_ids)

    cerrarFormulario()
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}

async function cambiarActivo(profesional: Profesional) {
  error.value = ''
  try {
    if (profesional.activo) {
      if (!confirm(`¿Desactivar a "${profesional.nombre}"? No va a poder recibir turnos.`)) return
      await profesionalesApi.desactivar(profesional.id)
    } else {
      await profesionalesApi.activar(profesional.id)
    }
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  }
}

function abrirAcceso(profesional: Profesional) {
  cerrarFormulario()
  profesionalAcceso.value = profesional
  acceso.email = ''
  acceso.password = ''
  mensaje.value = ''
}

async function darAcceso() {
  if (!profesionalAcceso.value) return
  guardando.value = true
  error.value = ''
  try {
    const profesional = await profesionalesApi.darAcceso(
      profesionalAcceso.value.id,
      acceso.email.trim(),
      acceso.password,
    )
    // La contraseña inicial no se vuelve a mostrar: hay que pasársela al profesional ahora
    mensaje.value = `Listo: ${profesional.nombre} ya puede entrar con ${profesional.email_acceso} y la contraseña que elegiste. Pasásela y pedile que la cambie desde "Mi cuenta".`
    profesionalAcceso.value = null
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}

async function quitarAcceso(profesional: Profesional) {
  if (
    !confirm(`¿Quitarle el acceso al panel a "${profesional.nombre}"? Sus turnos no se borran.`)
  ) {
    return
  }
  error.value = ''
  mensaje.value = ''
  try {
    await profesionalesApi.quitarAcceso(profesional.id)
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
      <h1>Profesionales</h1>
      <button v-if="!formularioAbierto" class="boton boton-primario" @click="abrirNuevo">
        Nuevo profesional
      </button>
    </div>

    <p v-if="error" class="alerta-error">{{ error }}</p>
    <p v-if="mensaje" class="alerta-exito" role="status">{{ mensaje }}</p>

    <form v-if="profesionalAcceso" class="tarjeta formulario" @submit.prevent="darAcceso">
      <h2>Dar acceso a {{ profesionalAcceso.nombre }}</h2>
      <p class="texto-suave ayuda">
        Va a poder entrar al panel para ver su agenda, cancelar sus turnos y bloquear sus días.
      </p>
      <div class="campo">
        <label for="acceso-email">Email</label>
        <input id="acceso-email" v-model="acceso.email" type="email" autocomplete="off" required />
      </div>
      <div class="campo">
        <label for="acceso-password">Contraseña inicial</label>
        <!-- type="text": el admin necesita ver lo que escribe para pasársela al profesional -->
        <input
          id="acceso-password"
          v-model="acceso.password"
          type="text"
          autocomplete="off"
          minlength="8"
          required
        />
      </div>
      <div class="acciones">
        <button type="button" class="boton" @click="profesionalAcceso = null">Cancelar</button>
        <button type="submit" class="boton boton-primario" :disabled="guardando">
          {{ guardando ? 'Guardando...' : 'Dar acceso' }}
        </button>
      </div>
    </form>

    <ProfesionalFormulario
      v-if="formularioAbierto"
      :key="profesionalEditado?.id ?? 'nuevo'"
      :profesional="profesionalEditado"
      :servicios="servicios"
      :guardando="guardando"
      class="formulario"
      @guardar="guardar"
      @cancelar="cerrarFormulario"
    />

    <p v-if="cargando" class="texto-suave">Cargando...</p>
    <table v-else-if="profesionales.length > 0" class="tabla">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Servicios</th>
          <th>Acceso al panel</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="profesional in profesionales" :key="profesional.id">
          <td>
            <strong>{{ profesional.nombre }}</strong>
          </td>
          <td>
            <div v-if="profesional.servicios.length > 0" class="lista-etiquetas">
              <span v-for="servicio in profesional.servicios" :key="servicio.id" class="etiqueta">
                {{ servicio.nombre }}
              </span>
            </div>
            <span v-else class="texto-suave">Sin servicios</span>
          </td>
          <td>
            <span v-if="profesional.email_acceso">{{ profesional.email_acceso }}</span>
            <span v-else class="texto-suave">Sin acceso</span>
          </td>
          <td>
            <span
              :class="['etiqueta', profesional.activo ? 'etiqueta-activo' : 'etiqueta-inactivo']"
            >
              {{ profesional.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td>
            <div class="acciones">
              <RouterLink :to="`/horarios?profesional=${profesional.id}`" class="boton">
                Horarios
              </RouterLink>
              <button class="boton" @click="abrirEdicion(profesional)">Editar</button>
              <button
                v-if="!profesional.email_acceso"
                class="boton"
                @click="abrirAcceso(profesional)"
              >
                Dar acceso
              </button>
              <!-- Tu propio acceso no se quita desde acá (te quedarías afuera del panel) -->
              <button
                v-else-if="auth.usuario?.profesional?.id !== profesional.id"
                class="boton"
                @click="quitarAcceso(profesional)"
              >
                Quitar acceso
              </button>
              <button
                :class="['boton', { 'boton-peligro': profesional.activo }]"
                @click="cambiarActivo(profesional)"
              >
                {{ profesional.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="texto-suave">Todavía no hay profesionales cargados.</p>
  </section>
</template>

<style scoped>
.formulario {
  margin-bottom: 1.5rem;
  max-width: 600px;
}

.formulario h2 {
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.ayuda {
  margin-bottom: 1rem;
}

.lista-etiquetas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lista-etiquetas .etiqueta {
  background: #e0f2f1;
  color: var(--color-primario-hover);
}

/* Con cuatro botones, si no entran en una fila pasan a la siguiente (sin partir el texto) */
.tabla .acciones {
  flex-wrap: wrap;
}

.tabla .boton {
  white-space: nowrap;
}
</style>
