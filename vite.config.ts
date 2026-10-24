import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    {
      name: 'remove-crx-platform',
      configResolved(config) {
        const rollupOptions = config.build.rollupOptions as Record<string, unknown> | undefined
        if (rollupOptions?.platform) {
          delete rollupOptions.platform
        }
      }
    }
  ],
  server: {
    port: 54322,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 54322,
    },
    cors: true,
  },
})
