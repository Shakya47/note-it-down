import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: 'public',
    lib: {
      entry: resolve(__dirname, 'src/content/index.tsx'),
      name: 'ContentScript',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'content.js',
        assetFileNames: 'content.[ext]',
      },
    },
  },
  esbuild: {
    // @ts-ignore - drop is valid in esbuild but missing in some Vite TS definitions
    drop: ['console', 'debugger'],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  }
})
