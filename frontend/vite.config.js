import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const BACKEND_TARGET = 'http://127.0.0.1:3001'

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      // Proxy API and inventory routes to backend (default port 3001)
      '^/inventario': {
        target: BACKEND_TARGET,
        changeOrigin: true
      },
      '^/api': {
        target: BACKEND_TARGET,
        changeOrigin: true
      },
      '^/uploads': {
        target: BACKEND_TARGET,
        changeOrigin: true
      },
      // Additional backend endpoints used by the legacy frontend
      '^/recetas': { target: BACKEND_TARGET, changeOrigin: true },
      '^/categorias': { target: BACKEND_TARGET, changeOrigin: true },
      '^/produccion': { target: BACKEND_TARGET, changeOrigin: true },
      '^/ventas': { target: BACKEND_TARGET, changeOrigin: true },
      '^/cortesias': { target: BACKEND_TARGET, changeOrigin: true },
      '^/cortesia': { target: BACKEND_TARGET, changeOrigin: true },
      '^/utensilios': { target: BACKEND_TARGET, changeOrigin: true },
      '^/backup': { target: BACKEND_TARGET, changeOrigin: true },
      '^/tienda/': { target: BACKEND_TARGET, changeOrigin: true },
      '^/visitas': { target: BACKEND_TARGET, changeOrigin: true }
    },
    // Allow Vite dev server to read files outside the react-app folder (parent `frontend`)
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  }
}))

// Vitest config is provided via Vite config
export const test = {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test-setup.js'
}
