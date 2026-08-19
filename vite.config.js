import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { progressiveRowsVitePlugin } from './scripts/progressive-rows-vite-plugin.mjs'
import { tallerCentralNavigationVitePlugin } from './scripts/taller-central-navigation-vite-plugin.mjs'
import { atrasoIchcFixesVitePlugin } from './scripts/atraso-ichc-fixes-vite-plugin.mjs'
import { intelligentRefreshVitePlugin } from './scripts/intelligent-refresh-vite-plugin.mjs'
import { vehicleKmMaintenanceVitePlugin } from './scripts/vehicle-km-maintenance-vite-plugin.mjs'
import { pmVehicleScopeVitePlugin } from './scripts/pm-vehicle-scope-vite-plugin.mjs'
import { pmVehicleDisplayVitePlugin } from './scripts/pm-vehicle-display-vite-plugin.mjs'
import { equipmentProfileCodeHistoryVitePlugin } from './scripts/equipment-profile-code-history-vite-plugin.mjs'
import { equipmentProfileLayoutFixVitePlugin } from './scripts/equipment-profile-layout-fix-vite-plugin.mjs'

export default defineConfig({
  plugins: [intelligentRefreshVitePlugin(), vehicleKmMaintenanceVitePlugin(), pmVehicleScopeVitePlugin(), pmVehicleDisplayVitePlugin(), equipmentProfileCodeHistoryVitePlugin(), equipmentProfileLayoutFixVitePlugin(), tallerCentralNavigationVitePlugin(), atrasoIchcFixesVitePlugin(), progressiveRowsVitePlugin(), react()],
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
