import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { progressiveRowsVitePlugin } from './scripts/progressive-rows-vite-plugin.mjs'
import { tallerCentralNavigationVitePlugin } from './scripts/taller-central-navigation-vite-plugin.mjs'
import { intelligentRefreshVitePlugin } from './scripts/intelligent-refresh-vite-plugin.mjs'

export default defineConfig({
  plugins: [intelligentRefreshVitePlugin(), tallerCentralNavigationVitePlugin(), progressiveRowsVitePlugin(), react()],
  server: {
    host: '0.0.0.0'
  },
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor'
          if (id.includes('xlsx')) return 'xlsx-vendor'
          return 'vendor'
        }
      }
    }
  }
})
