import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/inventory",
  outputDir: ".workspace/inventory-test-results",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: "http://127.0.0.1:4180",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4180 --strictPort",
    url: "http://127.0.0.1:4180",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
