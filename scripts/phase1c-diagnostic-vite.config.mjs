// Copied into the temporary baseline worktree by the diagnostic workflow.
// This overlay deliberately preserves the production Vite configuration and
// changes only the output directory and hidden source maps.
import { defineConfig } from "vite";
import baseConfig from "./vite.config.js";

export default defineConfig({
  ...baseConfig,
  build: {
    ...baseConfig.build,
    outDir: "dist-diagnostic",
    sourcemap: "hidden",
  },
});
