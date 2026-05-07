/// <reference types="vitest" />
import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import { readFileSync } from "fs";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const srcDir = resolve(__dirname, "src");
const sharedDir = resolve(__dirname, "../../packages/shared/src");

// Pick manifest based on BROWSER env var (set by scripts/build.js)
const browser = process.env.BROWSER || "chrome";
const manifestPath = resolve(
  __dirname,
  `src/manifests/manifest.${browser}.json`,
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Inject version from package.json
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8"),
);
manifest.version = pkg.version;

export default defineConfig({
  plugins: [svelte(), crx({ manifest }), nodePolyfills()],
  resolve: {
    alias: {
      src: srcDir,
      "@rabbithole/shared/lib": resolve(sharedDir, "lib"),
      "@rabbithole/shared/atproto/http": resolve(sharedDir, "atproto/http.ts"),
      "@rabbithole/shared/atproto/explore": resolve(
        sharedDir,
        "atproto/explore.ts",
      ),
      "@rabbithole/shared/types": resolve(sharedDir, "utils/types.ts"),
    },
  },
  build: {
    outDir: resolve(__dirname, `dist-${browser}`),
    rollupOptions: {
      input: {
        trail: resolve(__dirname, "src/trail/trail.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    server: {
      deps: {
        inline: ["@svelteuidev/core", "@svelteuidev/composables"],
      },
    },
  },
});
