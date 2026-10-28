import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Por ahora la pantalla de inicio es servicios; cuando exista la agenda, va a ser esa
    { path: '/', redirect: '/servicios' },
    {
      path: '/servicios',
      name: 'servicios',
      // Carga diferida: el código de la pantalla se descarga recién cuando se visita
      component: () => import('../views/ServiciosView.vue'),
    },
    {
      path: '/profesionales',
      name: 'profesionales',
      component: () => import('../views/ProfesionalesView.vue'),
    },
  ],
})

export default router
