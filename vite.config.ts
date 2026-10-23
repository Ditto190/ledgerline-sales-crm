import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import sparkPlugin from "@github/spark/spark-vite-plugin";
import { defineConfig, type PluginOption } from "vite";
import { resolve } from "node:path";

const projectRoot = process.env["PROJECT_ROOT"] || import.meta.dirname;

// Client-only Vite SPA (GitHub Spark runtime); no SSR/Nitro, runs natively on Windows.
export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    tailwindcss(),
    sparkPlugin() as PluginOption,
  ],
  resolve: { alias: { "@": resolve(projectRoot, "src") } },
  server: { port: 5000, host: "127.0.0.1" },
});
