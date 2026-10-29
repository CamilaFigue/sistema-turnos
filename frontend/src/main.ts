import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { cuandoExpireLaSesion } from './api/http'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Si la API responde 401 (sesión vencida), cerramos la sesión y volvemos al login
cuandoExpireLaSesion(() => {
  useAuthStore().cerrarSesion()
  const actual = router.currentRoute.value
  if (!actual.meta.publica) {
    router.push({ name: 'login', query: { volver: actual.fullPath } })
  }
})

app.mount('#app')
