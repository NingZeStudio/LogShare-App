import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initDisplayMode } from './lib/settings'

import './assets/styles/index.css'

// 挂载前先应用显示模式，减少主题闪烁
initDisplayMode()

const app = createApp(App)
app.use(router)
app.mount('#app')
