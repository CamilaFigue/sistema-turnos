import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // La pantalla de inicio es la agenda
    { path: '/', redirect: '/agenda' },
    {
      path: '/agenda',
      name: 'agenda',
      // Carga diferida: el código de la pantalla se descarga recién cuando se visita
      component: () => import('../views/AgendaView.vue'),
    },
    {
      path: '/servicios',
      name: 'servicios',
      component: () => import('../views/ServiciosView.vue'),
    },
    {
      path: '/profesionales',
      name: 'profesionales',
      component: () => import('../views/ProfesionalesView.vue'),
    },
    {
      path: '/horarios',
      name: 'horarios',
      component: () => import('../views/HorariosView.vue'),
    },
  ],
})

export default router
