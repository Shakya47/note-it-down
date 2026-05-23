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
        if (config.build.rollupOptions && (config.build.rollupOptions as any).platform) {
          delete (config.build.rollupOptions as any).platform;
        }
      }
    }
  ],
  esbuild: {
    // @ts-ignore - drop is valid in esbuild but missing in some Vite TS definitions
    drop: ['console', 'debugger'],
  },
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
