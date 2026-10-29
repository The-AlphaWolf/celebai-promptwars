import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    // `npm run dev` serves the UI; `npm start` runs the API on :8080.
    proxy: { '/api': 'http://localhost:8080' },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
      exclude: ['src/main.jsx', 'server/index.js'],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
    },
  },
})
