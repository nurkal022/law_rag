import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Сборка кладёт результат в ../static/app — Flask отдаёт его как обычную
 * статику, Node в production не нужен.
 *
 * В разработке /api проксируется на Flask (порт 5003), чтобы фронт и бэкенд
 * жили на одном источнике и не требовали CORS.
 */
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // В сборке ассеты лежат под /static/app/ у Flask; в разработке — от корня,
  // иначе dev-сервер уводит все маршруты в /static/app/ и роутинг не работает.
  base: command === 'build' ? '/static/app/' : '/',
  build: {
    outDir: '../static/app',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5003', changeOrigin: true },
    },
  },
}))
