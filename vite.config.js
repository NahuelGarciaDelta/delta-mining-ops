import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/google/all": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        rewrite: () =>
          "/macros/s/AKfycbwKaZwRXWUdSGq1sbgwollwy7-cWA2h7HMsiMxsPUQm754S9fs7p34hc6_wntt49nKgew/exec?action=all",
      },
    },
  },
});