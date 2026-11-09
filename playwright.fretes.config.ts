import { defineConfig } from "@playwright/test";
import { join } from "node:path";

if (!process.env.ZENWASTE_E2E_API_URL || !process.env.ZENWASTE_E2E_RESULTADOS) throw new Error("Execute pelo módulo fretes.executar_e2e para isolar PostgreSQL e credenciais sintéticas.");
const porta = process.env.ZENWASTE_E2E_PORTA_FRONTEND || "5187";
const endereco = `http://127.0.0.1:${porta}`;
export default defineConfig({
  testDir: "./tests/fretes", workers: 1, timeout: 90000, maxFailures: 1,
  outputDir: join(process.env.ZENWASTE_E2E_RESULTADOS, "navegador"),
  reporter: [["line"], ["json", { outputFile: join(process.env.ZENWASTE_E2E_RESULTADOS, "playwright.json") }]],
  use: { baseURL: endereco, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", actionTimeout: 15000, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: `npm run dev -- --host 127.0.0.1 --port ${porta} --strictPort`, url: endereco, reuseExistingServer: false, timeout: 60000 },
});
