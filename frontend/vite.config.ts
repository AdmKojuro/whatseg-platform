import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const proxyConfig = {
  '/api/vision': {
    target: 'http://localhost:8001',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/vision/, '/api'),
  },
  '/api': {
    target: 'https://api.whatseg.com',
    changeOrigin: true,
    secure: false,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: proxyConfig,
  },
  preview: {
    port: 5173,
    proxy: proxyConfig,
  },
})
