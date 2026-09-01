/// <reference types="vitest" />
import { crx } from "@crxjs/vite-plugin";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve, dirname } from "path";
import { readFileSync, readdirSync, copyFileSync, mkdirSync } from "fs";
import { createRequire } from "module";
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

// Plugin to copy ONNX Runtime WASM files to the output directory
function copyOrtWasm() {
  return {
    name: "copy-ort-wasm",
    closeBundle() {
      const require = createRequire(import.meta.url);
      const ortDir = dirname(require.resolve("onnxruntime-web"));
      const outDir = resolve(__dirname, `dist-${browser}`, "ort");
      mkdirSync(outDir, { recursive: true });
      const files = readdirSync(ortDir).filter(
        (f) => f.endsWith(".wasm") || f.endsWith(".mjs"),
      );
      for (const f of files) {
        copyFileSync(resolve(ortDir, f), resolve(outDir, f));
      }
      console.log(
        `[copy-ort-wasm] copied ${files.length} files to dist-${browser}/ort/`,
      );
    },
  };
}

export default defineConfig({
  plugins: [svelte(), crx({ manifest }), nodePolyfills(), copyOrtWasm()],
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        trail: resolve(__dirname, "src/trail/trail.html"),
      },
      onwarn(warning, defaultHandler) {
        // Suppress "overwrites a previously emitted file" for icons (CRXJS + Vite both emit them)
        if (
          warning.code === "FILE_NAME_CONFLICT" &&
          warning.message.includes("dark.png")
        )
          return;
        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          // Keep svelteui modules in the same chunk to avoid circular dependency issues
          if (id.includes("node_modules/@svelteuidev")) return "svelteui";
        },
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
