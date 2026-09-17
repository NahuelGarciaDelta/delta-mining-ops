import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { progressiveRowsVitePlugin } from './scripts/progressive-rows-vite-plugin.mjs'
import { tallerCentralNavigationVitePlugin } from './scripts/taller-central-navigation-vite-plugin.mjs'
import { atrasoIchcFixesVitePlugin } from './scripts/atraso-ichc-fixes-vite-plugin.mjs'
import { intelligentRefreshVitePlugin } from './scripts/intelligent-refresh-vite-plugin.mjs'
import { equipmentLiveDataFixesVitePlugin } from './scripts/equipment-live-data-fixes-vite-plugin.mjs'
import { supabaseSameOriginProxyVitePlugin } from './scripts/supabase-same-origin-proxy-vite-plugin.mjs'
import { abastecimientoLineEndingsVitePlugin } from './scripts/abastecimiento-line-endings-vite-plugin.mjs'
import { abastecimientoInstantVitePlugin } from './scripts/abastecimiento-instant-vite-plugin.mjs'
import { mutationIdempotencyVitePlugin } from './scripts/mutation-idempotency-vite-plugin.mjs'
import { rop02TruckPickupSplitVitePlugin } from './scripts/rop02-truck-pickup-split-vite-plugin.mjs'
import { rop02UnifyTrucksVitePlugin } from './scripts/rop02-unify-trucks-vite-plugin.mjs'
import { rop02DailyControlRegressionVitePlugin } from './scripts/rop02-daily-control-regression-vite-plugin.mjs'
import { administrativoDailyHiControlVitePlugin } from './scripts/administrativo-daily-hi-control-vite-plugin.mjs'
import { rop02TruckHistoryVitePlugin } from './scripts/rop02-truck-history-vite-plugin.mjs'
import { vehicleKmMaintenanceVitePlugin } from './scripts/vehicle-km-maintenance-vite-plugin.mjs'
import { pmVehicleScopeVitePlugin } from './scripts/pm-vehicle-scope-vite-plugin.mjs'
import { pmVehicleDisplayVitePlugin } from './scripts/pm-vehicle-display-vite-plugin.mjs'
import { equipmentProfileCodeHistoryVitePlugin } from './scripts/equipment-profile-code-history-vite-plugin.mjs'
import { equipmentProfilePlaceholderCodeFixVitePlugin } from './scripts/equipment-profile-placeholder-code-fix-vite-plugin.mjs'
import { equipmentProfileAliasProjectMultiselectVitePlugin } from './scripts/equipment-profile-alias-project-multiselect-vite-plugin.mjs'
import { equipmentProfileDeduplicateLastRop02VitePlugin } from './scripts/equipment-profile-deduplicate-last-rop02-vite-plugin.mjs'
import { equipmentProfileLocationVehicleLabelVitePlugin } from './scripts/equipment-profile-location-vehicle-label-vite-plugin.mjs'
import { equipmentProfileVehicleArrowsVitePlugin } from './scripts/equipment-profile-vehicle-arrows-vite-plugin.mjs'
import { equipmentProfilePmUnitsVitePlugin } from './scripts/equipment-profile-pm-units-vite-plugin.mjs'
import { rop02Rop05PositiveHoursVitePlugin } from './scripts/rop02-rop05-positive-hours-vite-plugin.mjs'
import { rop02StateClassificationVitePlugin } from './scripts/rop02-state-classification-vite-plugin.mjs'
import { rop02ControlVehicleFiltersVitePlugin } from './scripts/rop02-control-vehicle-filters-vite-plugin.mjs'

export default defineConfig({
  plugins: [supabaseSameOriginProxyVitePlugin(), abastecimientoLineEndingsVitePlugin(), rop02TruckPickupSplitVitePlugin(), rop02UnifyTrucksVitePlugin(), rop02DailyControlRegressionVitePlugin(), administrativoDailyHiControlVitePlugin(), rop02TruckHistoryVitePlugin(), rop02StateClassificationVitePlugin(), rop02Rop05PositiveHoursVitePlugin(), intelligentRefreshVitePlugin(), equipmentLiveDataFixesVitePlugin(), abastecimientoInstantVitePlugin(), mutationIdempotencyVitePlugin(), vehicleKmMaintenanceVitePlugin(), pmVehicleScopeVitePlugin(), pmVehicleDisplayVitePlugin(), equipmentProfileCodeHistoryVitePlugin(), equipmentProfilePlaceholderCodeFixVitePlugin(), equipmentProfileAliasProjectMultiselectVitePlugin(), equipmentProfileDeduplicateLastRop02VitePlugin(), equipmentProfileLocationVehicleLabelVitePlugin(), equipmentProfileVehicleArrowsVitePlugin(), equipmentProfilePmUnitsVitePlugin(), tallerCentralNavigationVitePlugin(), atrasoIchcFixesVitePlugin(), rop02ControlVehicleFiltersVitePlugin(), progressiveRowsVitePlugin(), react()],
  server: {
    host: '0.0.0.0'
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const file=String(id||'').replace(/\\/g,'/')
          if (!file.includes('/node_modules/')) return
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(file)) return 'react-vendor'
          if (file.includes('/node_modules/recharts/') || file.includes('/node_modules/d3-')) return 'charts-vendor'
          if (file.includes('/node_modules/xlsx/')) return 'xlsx-vendor'
        }
      }
    }
  }
})
