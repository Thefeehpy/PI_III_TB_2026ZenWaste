import { defineConfig } from "@playwright/test";
import { diretorioResultados } from "./tests/suporte/evidencias";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/fretes/**",
  outputDir: diretorioResultados(),
  use: {
    screenshot: "only-on-failure",
    baseURL: "http://127.0.0.1:5173",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
