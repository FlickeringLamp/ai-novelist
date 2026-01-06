import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  //:重写plugins
  plugins: [
    react(),
    {
      name: 'favicon-204',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/favicon.ico') {
            res.statusCode = 204
            res.end()
            return
          }
          next()
        })
      }
    }
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'build'
  }
})
