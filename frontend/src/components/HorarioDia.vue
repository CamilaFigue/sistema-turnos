<script setup lang="ts">
// Una franja mientras se edita. "clave" es un id solo del frontend para el :key del v-for,
// porque las franjas nuevas todavía no tienen id de la base de datos.
export interface FranjaEditable {
  clave: number
  hora_inicio: string
  hora_fin: string
}

defineProps<{
  nombre: string
}>()

// defineModel: el padre usa v-model="..." y este componente puede leer y cambiar ese valor
const franjas = defineModel<FranjaEditable[]>({ required: true })

// Las franjas que vienen de la base usan su id como clave; las nuevas, números negativos
let siguienteClave = -1

// Suma horas a un "HH:MM" sin pasarse de las 23:59
function sumarHoras(hora: string, horas: number): string {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  const minutos = Math.min(h * 60 + m + horas * 60, 23 * 60 + 59)
  const hh = String(Math.floor(minutos / 60)).padStart(2, '0')
  const mm = String(minutos % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function agregar() {
  // La nueva franja arranca donde termina la última (o a las 9 si es la primera)
  const ultima = franjas.value.at(-1)
  const inicio = ultima ? sumarHoras(ultima.hora_fin, 1) : '09:00'
  franjas.value = [
    ...franjas.value,
    { clave: siguienteClave--, hora_inicio: inicio, hora_fin: sumarHoras(inicio, 4) },
  ]
}

function quitar(clave: number) {
  franjas.value = franjas.value.filter((f) => f.clave !== clave)
}
</script>

<template>
  <div class="dia">
    <p class="nombre">{{ nombre }}</p>

    <div class="franjas">
      <p v-if="franjas.length === 0" class="texto-suave">No atiende</p>

      <div v-for="franja in franjas" :key="franja.clave" class="franja">
        <input
          v-model="franja.hora_inicio"
          type="time"
          required
          :aria-label="`${nombre}: hora de inicio`"
        />
        <span class="texto-suave">a</span>
        <input
          v-model="franja.hora_fin"
          type="time"
          required
          :aria-label="`${nombre}: hora de fin`"
        />
        <button
          type="button"
          class="boton boton-peligro"
          :aria-label="`Quitar franja del ${nombre}`"
          @click="quitar(franja.clave)"
        >
          Quitar
        </button>
      </div>

      <button type="button" class="boton agregar" @click="agregar">+ Agregar franja</button>
    </div>
  </div>
</template>

<style scoped>
.dia {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-borde);
}

.dia:last-child {
  border-bottom: none;
}

.nombre {
  font-weight: 600;
  padding-top: 0.4rem;
}

.franjas {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.franja {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.franja input {
  font: inherit;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio);
}

.agregar {
  font-size: 0.9rem;
  padding: 0.3rem 0.7rem;
}

@media (max-width: 700px) {
  .dia {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}
</style>
