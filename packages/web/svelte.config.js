import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/kit/vite";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      
      fallback: "index.html",
    }),
    alias: {
      "@rabbithole/shared/types": "../shared/src/utils/types.ts",
      "@rabbithole/shared/atproto/http": "../shared/src/atproto/http.ts",
      "@rabbithole/shared/atproto/explore": "../shared/src/atproto/explore.ts",
      "@rabbithole/shared/lib": "../shared/src/lib",
    },
  },
};

export default config;
