import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The API runs on :5080. Proxying /api keeps the browser same-origin, so the HttpOnly auth
// cookie just works and no CORS configuration is needed.
const apiProxy = { '/api': { target: 'http://localhost:5080' } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    // Playwright specs live in e2e/ and are run by `npm run e2e`.
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
