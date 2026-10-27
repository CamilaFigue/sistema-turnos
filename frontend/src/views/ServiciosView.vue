<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { serviciosApi, type DatosServicio, type Servicio } from '@/api/servicios'
import ServicioFormulario from '@/components/ServicioFormulario.vue'

// Estado de la pantalla: ref() hace que Vue vuelva a dibujar cuando cambia el valor
const servicios = ref<Servicio[]>([])
const cargando = ref(true)
const error = ref('')

// Formulario: cerrado, abierto para crear (null) o abierto para editar (un servicio)
const formularioAbierto = ref(false)
const servicioEditado = ref<Servicio | null>(null)
const guardando = ref(false)

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    servicios.value = await serviciosApi.listar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    cargando.value = false
  }
}

function abrirNuevo() {
  servicioEditado.value = null
  formularioAbierto.value = true
}

function abrirEdicion(servicio: Servicio) {
  servicioEditado.value = servicio
  formularioAbierto.value = true
}

function cerrarFormulario() {
  formularioAbierto.value = false
  servicioEditado.value = null
}

async function guardar(datos: DatosServicio) {
  guardando.value = true
  error.value = ''
  try {
    if (servicioEditado.value) {
      await serviciosApi.actualizar(servicioEditado.value.id, datos)
    } else {
      await serviciosApi.crear(datos)
    }
    cerrarFormulario()
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    guardando.value = false
  }
}

async function cambiarActivo(servicio: Servicio) {
  error.value = ''
  try {
    if (servicio.activo) {
      if (!confirm(`¿Desactivar "${servicio.nombre}"? No se va a poder reservar.`)) return
      await serviciosApi.desactivar(servicio.id)
    } else {
      await serviciosApi.activar(servicio.id)
    }
    await cargar()
  } catch (e) {
    error.value = (e as Error).message
  }
}

// onMounted: se ejecuta una vez, cuando la pantalla aparece
onMounted(cargar)
</script>

<template>
  <section>
    <div class="encabezado">
      <h1>Servicios</h1>
      <button v-if="!formularioAbierto" class="boton boton-primario" @click="abrirNuevo">
        Nuevo servicio
      </button>
    </div>

    <p v-if="error" class="alerta-error">{{ error }}</p>

    <!-- :key hace que el formulario se cree de nuevo al cambiar de servicio -->
    <ServicioFormulario
      v-if="formularioAbierto"
      :key="servicioEditado?.id ?? 'nuevo'"
      :servicio="servicioEditado"
      :guardando="guardando"
      class="formulario"
      @guardar="guardar"
      @cancelar="cerrarFormulario"
    />

    <p v-if="cargando" class="texto-suave">Cargando...</p>
    <table v-else-if="servicios.length > 0" class="tabla">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Duración</th>
          <th>Precio</th>
          <th>Estado</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="servicio in servicios" :key="servicio.id">
          <td>
            <strong>{{ servicio.nombre }}</strong>
            <p v-if="servicio.descripcion" class="texto-suave">{{ servicio.descripcion }}</p>
          </td>
          <td>{{ servicio.duracion_minutos }} min</td>
          <td>{{ formatoPrecio.format(servicio.precio) }}</td>
          <td>
            <span :class="['etiqueta', servicio.activo ? 'etiqueta-activo' : 'etiqueta-inactivo']">
              {{ servicio.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td>
            <div class="acciones">
              <button class="boton" @click="abrirEdicion(servicio)">Editar</button>
              <button
                :class="['boton', { 'boton-peligro': servicio.activo }]"
                @click="cambiarActivo(servicio)"
              >
                {{ servicio.activo ? 'Desactivar' : 'Activar' }}
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="texto-suave">Todavía no hay servicios cargados.</p>
  </section>
</template>

<style scoped>
.formulario {
  margin-bottom: 1.5rem;
  max-width: 600px;
}
</style>