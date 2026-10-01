import { defineConfig, mergeConfig } from 'vite'
import baseConfig from './vite.config.js'

export default mergeConfig(
  baseConfig,
  defineConfig({
    server: {
      proxy: {
        '/api': {
          target: 'https://delta-mining-ops.vercel.app',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }),
)
