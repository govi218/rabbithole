import { defineConfig } from "@playwright/test";
import { resolve } from "path";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
});
