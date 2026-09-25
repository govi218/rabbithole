import type { ZodSchema } from "zod";
import { getFirefoxProvider } from "./firefox";
import { getChromeProvider } from "./chrome";
import { getTransformersProvider } from "./transformers";
import type { CloudProviderConfig } from "./cloud";
import { getCloudProvider } from "./cloud";

// ─── Provider types ───

export type ProviderType = "chrome" | "firefox" | "transformersjs" | "cloud";

export type JSONSchema = Record<string, unknown>;

export interface ClassificationResult {
  label: string;
  score: number;
  allScores: { label: string; score: number }[];
}

export interface GenerateOptions<T = unknown> {
  prompt: string;
  systemPrompt?: string;
  schema?: JSONSchema;
  validator?: ZodSchema<T>;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult<T = unknown> {
  data: T;
  raw: string;
  providerType: ProviderType;
}

export interface LLMProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  classify(text: string, labels: string[]): Promise<ClassificationResult>;
  generate<T = string>(opts: GenerateOptions<T>): Promise<GenerateResult<T>>;
  dispose?(): Promise<void>;
}

export interface ProgressInfo {
  type: "downloading" | "loading" | "ready";
  progress?: number;
  message?: string;
}

export type ProgressCallback = (info: ProgressInfo) => void;

// ─── Skill types ───

export interface SkillContext<Output = unknown> {
  systemPrompt: string;
  userPrompt: string;
  schema?: JSONSchema;
  validator?: ZodSchema<Output>;
  maxTokens?: number;
  temperature?: number;
}

export interface Skill<Input, Output> {
  name: string;
  buildContext(input: Input): SkillContext<Output>;
}

export interface SkillResult<Output> {
  data: Output;
  raw: string;
  providerType: ProviderType;
}

// ─── Prompt helpers ───

const DefaultSystemPrompt =
  "You are a helpful assistant that follows instructions precisely.";

/** Extract the expected keys from a JSON schema for prompt instructions. */
export function schemaKeys(schema: JSONSchema): string[] {
  const props = (schema as any)?.properties;
  if (!props || typeof props !== "object") return [];
  return Object.keys(props);
}

/** Build the user-facing prompt from GenerateOptions. */
export function buildUserPrompt<T>(opts: GenerateOptions<T>): string {
  let content = opts.prompt;
  if (opts.schema) {
    content += `\n\nReturn ONLY valid JSON matching this schema. No other text.\n\n${JSON.stringify(opts.schema, null, 2)}`;
  }
  return content;
}

/** Get the system prompt or fall back to the default. */
export function getSystemPrompt<T>(opts: GenerateOptions<T>): string {
  return opts.systemPrompt ?? DefaultSystemPrompt;
}

/** Parse and validate raw output. Throws on invalid JSON or validation failure. */
export function parseOutput<T>(raw: string, opts: GenerateOptions<T>): T {
  if (!opts.validator && !opts.schema) return raw as unknown as T;
  const parsed = JSON.parse(raw);
  if (opts.validator) return opts.validator.parse(parsed) as T;
  return parsed as T;
}

// ─── Provider factory ───

let cachedProvider: LLMProvider | null = null;
let cachedType: ProviderType | null = null;

/**
 * Detect and return the best available LLM provider for the current browser.
 * Tries Cloud (if API key provided) → Firefox trial.ml → Chrome LanguageModel → Transformers.js fallback.
 */
export async function getLLMProvider(
  onProgress?: ProgressCallback,
  cloudConfig?: CloudProviderConfig,
): Promise<{ provider: LLMProvider; providerType: ProviderType } | null> {
  if (cachedProvider && cachedType) {
    return { provider: cachedProvider, providerType: cachedType };
  }

  // 0. Cloud provider (if API key configured)
  if (cloudConfig?.apiKey) {
    const cloud = getCloudProvider(cloudConfig);
    if (await cloud.isAvailable()) {
      cachedProvider = cloud;
      cachedType = "cloud";
      return { provider: cloud, providerType: "cloud" };
    }
  }

  // 1. Firefox trial.ml
  const firefox = getFirefoxProvider(onProgress);
  if (await firefox.isAvailable()) {
    cachedProvider = firefox;
    cachedType = "firefox";
    return { provider: firefox, providerType: "firefox" };
  }

  // 2. Chrome LanguageModel Prompt API
  const chrome = getChromeProvider(onProgress);
  if (await chrome.isAvailable()) {
    cachedProvider = chrome;
    cachedType = "chrome";
    return { provider: chrome, providerType: "chrome" };
  }

  // 3. Transformers.js fallback (any browser with WASM)
  const transformers = getTransformersProvider(onProgress);
  if (await transformers.isAvailable()) {
    cachedProvider = transformers;
    cachedType = "transformersjs";
    return { provider: transformers, providerType: "transformersjs" };
  }

  return null;
}

/** Clear the cached provider (forces re-detection on next getLLMProvider call). */
export function clearProviderCache(): void {
  cachedProvider = null;
  cachedType = null;
}

/** Run a skill: build context → detect provider → generate → return parsed result. */
export async function runSkill<Input, Output>(
  skill: Skill<Input, Output>,
  input: Input,
  options?: {
    cloudConfig?: CloudProviderConfig;
    onProgress?: ProgressCallback;
  },
): Promise<SkillResult<Output>> {
  const ctx = skill.buildContext(input);
  const detected = await getLLMProvider(
    options?.onProgress,
    options?.cloudConfig,
  );
  if (!detected) {
    throw new Error(`No LLM provider available for skill "${skill.name}"`);
  }

  const { provider, providerType } = detected;
  const result = await provider.generate<Output>({
    prompt: ctx.userPrompt,
    systemPrompt: ctx.systemPrompt,
    schema: ctx.schema,
    validator: ctx.validator,
    maxTokens: ctx.maxTokens,
    temperature: ctx.temperature,
  });

  return {
    data: result.data,
    raw: result.raw,
    providerType,
  };
}
