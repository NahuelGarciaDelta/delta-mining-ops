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
import { equipmentProfileAliasProjectMultiselectVitePlugin } from './scripts/equipment-profile-alias-project-multiselect-vite-plugin.mjs'
import { equipmentProfileDeduplicateLastRop02VitePlugin } from './scripts/equipment-profile-deduplicate-last-rop02-vite-plugin.mjs'
import { equipmentProfileLocationVehicleLabelVitePlugin } from './scripts/equipment-profile-location-vehicle-label-vite-plugin.mjs'
import { equipmentProfileVehicleArrowsVitePlugin } from './scripts/equipment-profile-vehicle-arrows-vite-plugin.mjs'

export default defineConfig({
  plugins: [intelligentRefreshVitePlugin(), vehicleKmMaintenanceVitePlugin(), pmVehicleScopeVitePlugin(), pmVehicleDisplayVitePlugin(), equipmentProfileCodeHistoryVitePlugin(), equipmentProfileAliasProjectMultiselectVitePlugin(), equipmentProfileDeduplicateLastRop02VitePlugin(), equipmentProfileLocationVehicleLabelVitePlugin(), equipmentProfileVehicleArrowsVitePlugin(), tallerCentralNavigationVitePlugin(), atrasoIchcFixesVitePlugin(), progressiveRowsVitePlugin(), react()],
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
