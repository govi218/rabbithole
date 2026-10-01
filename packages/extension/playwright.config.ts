import { defineConfig } from "@playwright/test";

delete process.env.OPENROUTER_API_KEY;
process.loadEnvFile(".env");

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
});
