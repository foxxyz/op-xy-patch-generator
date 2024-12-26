import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import App from './app.vue'
import HomePage from './pages/home.vue'

// Set up app
const app = createApp(App)

// Set up router
const routes = [
    { path: '/', component: HomePage },
    { path: '/:catchAll(.*)', redirect: '/' },
]
const router = createRouter({ routes, history: createWebHistory() })
app.use(router)

app.mount('body')
