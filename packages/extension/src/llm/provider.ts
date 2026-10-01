import type { ZodSchema } from "zod";
import type { CloudProviderConfig } from "./cloud";
import { getCloudProvider } from "./cloud";

export type JSONSchema = Record<string, unknown>;

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
}

export interface LLMProvider {
  generate<T = string>(opts: GenerateOptions<T>): Promise<GenerateResult<T>>;
}

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
}

const DefaultSystemPrompt =
  "You are a helpful assistant that follows instructions precisely.";

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
  // models sometimes wrap JSON in markdown fences — strip before parsing
  const stripped = raw
    .replace(/^\s*```(?:json)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
  const parsed = JSON.parse(stripped);
  if (opts.validator) return opts.validator.parse(parsed) as T;
  return parsed as T;
}

/** Run a skill: build context → cloud generate → return parsed result. */
export async function runSkill<Input, Output>(
  skill: Skill<Input, Output>,
  input: Input,
  options?: { cloudConfig?: CloudProviderConfig },
): Promise<SkillResult<Output>> {
  const ctx = skill.buildContext(input);
  if (!options?.cloudConfig?.apiKey) {
    throw new Error(`No cloud API key configured for skill "${skill.name}"`);
  }
  const provider = getCloudProvider(options.cloudConfig);
  const result = await provider.generate<Output>({
    prompt: ctx.userPrompt,
    systemPrompt: ctx.systemPrompt,
    schema: ctx.schema,
    validator: ctx.validator,
    maxTokens: ctx.maxTokens,
    temperature: ctx.temperature,
  });
  return { data: result.data, raw: result.raw };
}
