<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { profesionalesApi, type Profesional } from '@/api/profesionales'
import { serviciosApi, type Servicio } from '@/api/servicios'
import ProfesionalFormulario, {
  type FormularioProfesional,
} from '@/components/ProfesionalFormulario.vue'

const profesionales = ref<Profesional[]>([])
const servicios = ref<Servicio[]>([])
const cargando = ref(true)
const error = ref('')

const formularioAbierto = ref(false)
const profesionalEditado = ref<Profesional | null>(null)
const guardando = ref(false)

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
            <span
              :class="['etiqueta', profesional.activo ? 'etiqueta-activo' : 'etiqueta-inactivo']"
            >
              {{ profesional.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td>
            <div class="acciones">
              <button class="boton" @click="abrirEdicion(profesional)">Editar</button>
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

.lista-etiquetas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.lista-etiquetas .etiqueta {
  background: #e0f2f1;
  color: var(--color-primario-hover);
}
</style>
