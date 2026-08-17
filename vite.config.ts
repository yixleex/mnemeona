import { fileURLToPath } from "node:url"
import path from "node:path"

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,

    host: host || false,

    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,

    watch: {
        ignored: [
            "**/tauri/**",
            "**/mnemeona-image/**"
        ],
      },
  },

  envPrefix: ["VITE_", "TAURI_ENV_*"],

  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "safari13",

    minify: !process.env.TAURI_ENV_DEBUG
      ? "esbuild"
      : false,

    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
