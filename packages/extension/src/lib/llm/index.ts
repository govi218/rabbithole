import type { LLMProvider, ProviderType, ProgressCallback } from "./types";
import { getFirefoxProvider } from "./firefox";
import { getChromeProvider } from "./chrome";
import { getTransformersProvider } from "./transformers";

export type {
  LLMProvider,
  ClassificationResult,
  ProviderType,
  ProgressCallback,
} from "./types";

let cachedProvider: LLMProvider | null = null;
let cachedType: ProviderType | null = null;

/**
 * Detect and return the best available LLM provider for the current browser.
 * Tries Firefox trial.ml → Chrome LanguageModel → Transformers.js fallback.
 */
export async function getLLMProvider(
  onProgress?: ProgressCallback,
): Promise<{ provider: LLMProvider; type: ProviderType } | null> {
  if (cachedProvider && cachedType) {
    return { provider: cachedProvider, type: cachedType };
  }

  // 1. Firefox trial.ml
  const firefox = getFirefoxProvider(onProgress);
  if (await firefox.isAvailable()) {
    cachedProvider = firefox;
    cachedType = "firefox";
    return { provider: firefox, type: "firefox" };
  }

  // 2. Chrome LanguageModel Prompt API
  const chrome = getChromeProvider(onProgress);
  if (await chrome.isAvailable()) {
    cachedProvider = chrome;
    cachedType = "chrome";
    return { provider: chrome, type: "chrome" };
  }

  // 3. Transformers.js fallback (any browser with WASM)
  const transformers = getTransformersProvider(onProgress);
  if (await transformers.isAvailable()) {
    cachedProvider = transformers;
    cachedType = "transformers";
    return { provider: transformers, type: "transformers" };
  }

  return null;
}

/** Clear the cached provider (forces re-detection on next getLLMProvider call). */
export function clearProviderCache(): void {
  cachedProvider = null;
  cachedType = null;
}
