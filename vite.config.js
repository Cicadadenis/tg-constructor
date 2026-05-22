import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const validatePythonStub = path.resolve(rootDir, 'core/codegen/validatePython.stub.js')

function devServerBanner() {
  return {
    name: 'cicada-dev-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr?.port ? addr.port : '?'
        console.log(`\n  Cicada UI → http://localhost:${port}/\n`)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:3001'
  const devPort = Number(env.VITE_DEV_PORT) || 5173

  return {
    base: './',
    plugins: [react(), devServerBanner()],
    resolve: {
      alias: {
        // Prevent Node py_compile from entering the client bundle if imported transitively.
        [path.resolve(rootDir, 'core/codegen/validatePython.mjs')]: validatePythonStub,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: devPort,
      strictPort: env.VITE_STRICT_PORT !== 'false',
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/firmware': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/flash': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/esphome': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
