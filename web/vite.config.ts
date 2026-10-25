import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4000"
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vis-timeline": ["vis-timeline/standalone"]
        }
      }
    }
  }
});
