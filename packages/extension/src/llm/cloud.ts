import type { GenerateOptions, GenerateResult, LLMProvider } from "./provider";
import { buildUserPrompt, getSystemPrompt, parseOutput } from "./provider";
import { debug as logDebug } from "../utils/logger";

export interface CloudProviderConfig {
  apiKey: string;
  providerId?: CloudProviderId;
  model?: string;
  // extra request body fields (e.g. reasoning: {enabled: false} for DeepSeek)
  extraBody?: Record<string, unknown>;
}

export type CloudProviderId =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "mistral";

export const CloudProviders: Record<
  CloudProviderId,
  { label: string; baseUrl: string; model: string }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    // benchmarked on the 188-tab eval dataset — see
    // test/categorisation/benchmarks/RESULTS.md. Gemini Flash-Lite:
    // fastest, cheapest tier.
    model: "google/gemini-3.1-flash-lite",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
  },
};

export function getCloudProvider(config: CloudProviderConfig): LLMProvider {
  const providerId = config.providerId ?? "openai";
  const defaults = CloudProviders[providerId];
  const baseUrl = defaults.baseUrl;
  const model = config.model ?? defaults.model;

  async function chat(
    messages: { role: string; content: string }[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: any;
    },
  ): Promise<string> {
    const body: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 512,
    };
    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }
    if (config.extraBody) {
      Object.assign(body, config.extraBody);
    }

    logDebug(`[cloud] POST ${baseUrl}/chat/completions`, { model });
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[cloud] API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    logDebug(`[cloud] response:`, JSON.stringify(content));
    return content;
  }

  async function generate<T = string>(
    opts: GenerateOptions<T>,
  ): Promise<GenerateResult<T>> {
    const messages = [
      { role: "system", content: getSystemPrompt(opts) },
      { role: "user", content: buildUserPrompt(opts) },
    ];

    const responseFormat = opts.schema
      ? { type: "json_object" as const }
      : undefined;

    const raw = await chat(messages, {
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      responseFormat,
    });

    const data = parseOutput(raw, opts);
    return { data, raw, providerType: "cloud" };
  }

  return { generate };
}
