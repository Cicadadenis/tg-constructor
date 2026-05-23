import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const validatePythonStub = path.resolve(rootDir, 'core/codegen/validatePython.stub.js')

function parseTruthyFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())
}

function devServerBanner() {
  return {
    name: 'cicada-dev-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        const port = typeof addr === 'object' && addr?.port ? addr.port : '?'
        console.log(`\n  Cicada UI (development) → http://localhost:${port}/\n`)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDevMode = mode !== 'production'
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:3001'
  const devPort = Number(env.VITE_DEV_PORT) || 5173
  const localInstallBypass =
    parseTruthyFlag(env.AUTH_BYPASS || env.VITE_AUTH_BYPASS)
    && (env.APP_ENV === 'development' || env.NODE_ENV === 'development');
  const authBypassActive = parseTruthyFlag(env.AUTH_BYPASS || env.VITE_AUTH_BYPASS)
    && (isDevMode || localInstallBypass);

  return {
    base: './',
    plugins: [react(), devServerBanner()],
    define: {
      'import.meta.env.VITE_AUTH_BYPASS': JSON.stringify(authBypassActive ? '1' : '0'),
      'import.meta.env.VITE_APP_MODE': JSON.stringify(isDevMode ? 'development' : 'production'),
    },
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
        '/dev': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/debug': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/debug-ide-app.js': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
