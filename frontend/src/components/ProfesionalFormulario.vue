<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Profesional } from '@/api/profesionales'
import type { Servicio } from '@/api/servicios'

// Lo que el formulario le devuelve al padre al guardar
export interface FormularioProfesional {
  nombre: string
  servicio_ids: number[]
}

const props = defineProps<{
  profesional: Profesional | null
  servicios: Servicio[]
  guardando: boolean
}>()

const emit = defineEmits<{
  guardar: [datos: FormularioProfesional]
  cancelar: []
}>()

const formulario = reactive({
  nombre: props.profesional?.nombre ?? '',
  // Ids de los servicios tildados. Al editar, arranca con los que ya tiene asignados.
  servicio_ids: props.profesional?.servicios.map((s) => s.id) ?? [],
})

// computed: un valor que se recalcula solo cuando cambia algo de lo que depende.
// Mostramos los servicios activos y, además, los inactivos que el profesional ya tenía,
// para que no se le quiten sin querer al guardar.
const serviciosElegibles = computed(() =>
  props.servicios.filter((s) => s.activo || formulario.servicio_ids.includes(s.id)),
)

function enviar() {
  emit('guardar', {
    nombre: formulario.nombre.trim(),
    servicio_ids: formulario.servicio_ids,
  })
}
</script>

<template>
  <form class="tarjeta" @submit.prevent="enviar">
    <h2>{{ profesional ? 'Editar profesional' : 'Nuevo profesional' }}</h2>

    <div class="campo">
      <label for="nombre">Nombre</label>
      <input id="nombre" v-model="formulario.nombre" required maxlength="100" />
    </div>

    <fieldset class="campo">
      <legend>Servicios que realiza</legend>
      <p v-if="serviciosElegibles.length === 0" class="texto-suave">
        No hay servicios activos. Crealos primero en la pantalla de Servicios.
      </p>
      <!-- v-model sobre varios checkbox con el mismo array: tildar agrega el id, destildar lo quita -->
      <label v-for="servicio in serviciosElegibles" :key="servicio.id" class="opcion">
        <input v-model="formulario.servicio_ids" type="checkbox" :value="servicio.id" />
        {{ servicio.nombre }}
        <span v-if="!servicio.activo" class="texto-suave">(inactivo)</span>
      </label>
    </fieldset>

    <div class="acciones">
      <button type="button" class="boton" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="boton boton-primario" :disabled="guardando">
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
h2 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
}

fieldset {
  border: none;
  padding: 0;
}

legend {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.opcion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}
</style>
