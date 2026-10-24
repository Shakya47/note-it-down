import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The built app is served by the sync worker (see wrangler.toml at the repo root),
// so the app and the sync API share one origin.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../sync-worker/public'),
    emptyOutDir: true,
  },
  server: {
    port: 5180,
  },
})
