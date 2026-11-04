import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// "meta" son datos extra de cada ruta. Le contamos a TypeScript cuáles usamos.
declare module 'vue-router' {
  interface RouteMeta {
    publica?: boolean // se puede ver sin iniciar sesión
    soloAdmin?: boolean // solo para administradores (un profesional vuelve a la agenda)
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { publica: true },
    },
    {
      // Página para pacientes: /reservar/consultorio-salud-integral
      path: '/reservar/:slug',
      name: 'reservar',
      component: () => import('../views/ReservarView.vue'),
      meta: { publica: true },
    },
    {
      // Link que recibe el paciente al reservar, para cancelar su turno sin iniciar sesión
      path: '/reservar/:slug/cancelar/:codigo',
      name: 'cancelar-turno',
      component: () => import('../views/CancelarTurnoView.vue'),
      meta: { publica: true },
    },
    // La pantalla de inicio es la agenda
    { path: '/', redirect: '/agenda' },
    {
      path: '/agenda',
      name: 'agenda',
      // Carga diferida: el código de la pantalla se descarga recién cuando se visita
      component: () => import('../views/AgendaView.vue'),
    },
    {
      path: '/bloqueos',
      name: 'bloqueos',
      component: () => import('../views/BloqueosView.vue'),
    },
    {
      path: '/cuenta',
      name: 'cuenta',
      component: () => import('../views/CuentaView.vue'),
    },
    {
      path: '/servicios',
      name: 'servicios',
      component: () => import('../views/ServiciosView.vue'),
      meta: { soloAdmin: true },
    },
    {
      path: '/profesionales',
      name: 'profesionales',
      component: () => import('../views/ProfesionalesView.vue'),
      meta: { soloAdmin: true },
    },
    {
      path: '/horarios',
      name: 'horarios',
      component: () => import('../views/HorariosView.vue'),
      meta: { soloAdmin: true },
    },
  ],
})

// Guardia global: se ejecuta antes de entrar a cualquier pantalla
router.beforeEach(async (destino) => {
  const auth = useAuthStore()
  await auth.cargarUsuario()

  // Pantalla privada sin sesión: al login, recordando adónde quería ir
  if (!destino.meta.publica && !auth.estaLogueado) {
    return { name: 'login', query: { volver: destino.fullPath } }
  }
  // Ya logueado no tiene sentido ver el login
  if (destino.name === 'login' && auth.estaLogueado) {
    return { path: '/' }
  }
  // Un profesional que escribe /servicios en la barra vuelve a su agenda
  if (destino.meta.soloAdmin && !auth.esAdmin) {
    return { name: 'agenda' }
  }
})

export default router
