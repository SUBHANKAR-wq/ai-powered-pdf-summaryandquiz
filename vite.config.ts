import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // This proxy is useful when running the Vite dev server and the Vercel dev
    // server (`vercel dev`) simultaneously. It forwards API requests
    // from Vite to the Vercel backend.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
