<script setup lang="ts">
import { reactive } from 'vue'
import type { DatosServicio, Servicio } from '@/api/servicios'

// props: lo que recibe del padre. Si viene un servicio, el formulario es para editarlo.
const props = defineProps<{
  servicio: Servicio | null
  guardando: boolean
}>()

// emits: los avisos que le manda al padre. El formulario no llama a la API: solo avisa.
const emit = defineEmits<{
  guardar: [datos: DatosServicio]
  cancelar: []
}>()

// Copia de los datos para editar sin tocar el original hasta que se guarde
const formulario = reactive({
  nombre: props.servicio?.nombre ?? '',
  descripcion: props.servicio?.descripcion ?? '',
  duracion_minutos: props.servicio?.duracion_minutos ?? 30,
  precio: props.servicio?.precio ?? 0,
})

function enviar() {
  emit('guardar', {
    nombre: formulario.nombre.trim(),
    descripcion: formulario.descripcion.trim() || null,
    duracion_minutos: formulario.duracion_minutos,
    precio: formulario.precio,
  })
}
</script>

<template>
  <form class="tarjeta" @submit.prevent="enviar">
    <h2>{{ servicio ? 'Editar servicio' : 'Nuevo servicio' }}</h2>

    <div class="campo">
      <label for="nombre">Nombre</label>
      <input id="nombre" v-model="formulario.nombre" required maxlength="100" />
    </div>

    <div class="campo">
      <label for="descripcion">Descripción</label>
      <textarea id="descripcion" v-model="formulario.descripcion" rows="2" />
    </div>

    <div class="fila">
      <div class="campo">
        <label for="duracion">Duración (minutos)</label>
        <!-- v-model.number convierte el texto del input en número -->
        <input
          id="duracion"
          v-model.number="formulario.duracion_minutos"
          type="number"
          min="5"
          step="5"
          required
        />
      </div>

      <div class="campo">
        <label for="precio">Precio</label>
        <input
          id="precio"
          v-model.number="formulario.precio"
          type="number"
          min="0"
          step="0.01"
          required
        />
      </div>
    </div>

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

.fila {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
</style>