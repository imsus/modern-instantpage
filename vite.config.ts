import { defineConfig } from 'vite'
import { resolve } from 'path'

const banner = `/*! instant.page v6.0.0 - (C) 2019-2026 Alexandre Dieulot - https://instant.page/license */
/*! Modernized fork by imsus - https://github.com/imsus/modern-instantpage */`

const sharedTerserOptions = {
  compress: {
    passes: 2,
    drop_console: true,
  },
  mangle: { toplevel: true },
}

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/instantpage.ts'),
      name: 'InstantPage',
      formats: ['iife', 'es'],
      fileName: (format) => {
        if (format === 'iife') return 'instantpage.min.js'
        return 'instantpage.es.js'
      },
    },
    minify: 'terser',
    terserOptions: sharedTerserOptions,
    sourcemap: false,
    rollupOptions: {
      output: {
        banner,
      },
    },
  },
})
