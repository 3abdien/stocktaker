/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
//
// Two things beyond the defaults:
//  1. `test` - configures Vitest (our test runner) to simulate a browser
//     DOM via jsdom, since our components render into a document.
//  2. `server.port` - pinned to 5173 so it matches the CORS_ORIGINS value
//     the backend's .env.example already lists.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
