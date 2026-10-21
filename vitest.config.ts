import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'sync-worker/**/*.test.ts'],
    environment: 'node',
  },
})
