import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const CSS_PLACEHOLDER = '__NID_INLINE_CSS__'

/**
 * Moves the compiled stylesheet into the script (replacing CSS_TEXT's
 * placeholder in src/content/styles.ts) instead of emitting content.css, so
 * no web-accessible resource is needed to style the shadow root and PiP window.
 */
function inlineCss(): Plugin {
  return {
    name: 'nid-inline-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const cssFiles = Object.values(bundle).filter(
        (file) => file.type === 'asset' && file.fileName.endsWith('.css')
      )
      const css = cssFiles
        .map((file) => (file.type === 'asset' ? String(file.source) : ''))
        .join('\n')
      for (const file of cssFiles) delete bundle[file.fileName]

      const placeholder = new RegExp(`(["'\`])${CSS_PLACEHOLDER}\\1`)
      const chunk = Object.values(bundle).find(
        (file) => file.type === 'chunk' && placeholder.test(file.code)
      )
      if (!chunk || chunk.type !== 'chunk') {
        this.error(`CSS placeholder ${CSS_PLACEHOLDER} not found in the content script bundle`)
      }
      chunk.code = chunk.code.replace(placeholder, () => JSON.stringify(css))
    },
  }
}

export default defineConfig({
  plugins: [react(), inlineCss()],
  // Output goes into public/; don't copy public/ into itself.
  publicDir: false,
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
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
