import type {
  ClassificationResult,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
} from "./provider";
import { buildUserPrompt, getSystemPrompt, parseOutput } from "./provider";

export interface CloudProviderConfig {
  apiKey: string;
  providerId?: CloudProviderId;
  model?: string;
}

export type CloudProviderId = "openai" | "anthropic" | "openrouter" | "groq" | "mistral";

export const CloudProviders: Record<CloudProviderId, { label: string; baseUrl: string; model: string }> = {
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  anthropic: { label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-20250514" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  mistral: { label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
};

export function getCloudProvider(
  config: CloudProviderConfig,
): LLMProvider {
  const providerId = config.providerId ?? "openai";
  const defaults = CloudProviders[providerId];
  const baseUrl = defaults.baseUrl;
  const model = config.model ?? defaults.model;

  async function isAvailable(): Promise<boolean> {
    return !!config.apiKey;
  }

  async function chat(
    messages: { role: string; content: string }[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: any },
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

    console.log(`[cloud] POST ${baseUrl}/chat/completions`, { model });
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
    console.log(`[cloud] response:`, JSON.stringify(content));
    return content;
  }

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    const labelsText = labels.map((l) => `- ${l}`).join("\n");
    const schema = {
      type: "object",
      properties: {
        label: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["label", "confidence"],
    };

    const prompt = `Classify the following text into exactly one of these categories. Return the best matching category name and a confidence score between 0 and 1.

Categories:
${labelsText}

Text: "${text}"

Return ONLY valid JSON with these keys: "label", "confidence". No other text.`;

    const raw = await chat(
      [
        { role: "system", content: "You are a text classification assistant." },
        { role: "user", content: prompt },
      ],
      { responseFormat: { type: "json_object" } },
    );

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { label: labels[0], confidence: 0 };
    }

    return {
      label: parsed.label,
      score: parsed.confidence,
      allScores: labels.map((label) => ({
        label,
        score: label === parsed.label ? parsed.confidence : 0,
      })),
    };
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

  async function dispose(): Promise<void> {}

  return { name: "cloud", isAvailable, classify, generate, dispose };
}
