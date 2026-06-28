import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEBUG__: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
