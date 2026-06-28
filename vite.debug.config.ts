import { defineConfig } from 'vite'
import { resolve } from 'path'

const banner = `/*! instant.page v6.0.0 - (C) 2019-2026 Alexandre Dieulot - https://instant.page/license */
/*! Modernized fork by imsus - https://github.com/imsus/modern-instantpage */
/*! DEBUG BUILD */`

export default defineConfig({
  define: {
    __DEBUG__: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/instantpage.ts'),
      name: 'InstantPage',
      formats: ['iife', 'es'],
      fileName: (format) => {
        if (format === 'iife') return 'instantpage-debug.min.js'
        return 'instantpage-debug.es.js'
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: { passes: 1 },
      mangle: { toplevel: true },
    },
    sourcemap: false,
    emptyOutDir: false,
    rollupOptions: {
      output: {
        banner,
        footer: 'if(typeof window!=="undefined"){window.__INSTANT_PAGE_DEBUG__=true}',
      },
    },
  },
})
