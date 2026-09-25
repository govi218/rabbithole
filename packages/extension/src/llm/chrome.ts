import type {
  ClassificationResult,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
  ProgressCallback,
} from "./provider";
import { buildUserPrompt, getSystemPrompt, parseOutput } from "./provider";

export function getChromeProvider(onProgress?: ProgressCallback): LLMProvider {
  let session: any = null;

  async function isAvailable(): Promise<boolean> {
    const LM = (globalThis as any).LanguageModel;
    if (!LM) return false;
    try {
      const availability = await LM.availability();
      return availability !== "unavailable";
    } catch {
      return false;
    }
  }

  async function ensureSession() {
    if (session) return;
    console.log(`[chrome] creating LanguageModel session`);
    if (onProgress) onProgress({ type: "loading" });

    session = await (globalThis as any).LanguageModel.create({
      monitor(m: any) {
        m.addEventListener("downloadprogress", (e: any) => {
          console.log(`[chrome] download progress:`, e.loaded);
          if (onProgress)
            onProgress({ type: "downloading", progress: e.loaded });
        });
      },
    });

    console.log(`[chrome] session ready`);
    if (onProgress) onProgress({ type: "ready" });
  }

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    const LM = (globalThis as any).LanguageModel;
    if (!LM) throw new Error("Chrome LanguageModel not available");

    await ensureSession();

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

Return JSON with "label" (the exact category name) and "confidence" (0-1).`;

    const result = await session.prompt(prompt, {
      responseConstraint: schema,
    });
    const parsed = JSON.parse(result);

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
    await ensureSession();

    const promptOptions: any = {};
    if (opts.schema) {
      promptOptions.responseConstraint = opts.schema;
    }
    if (opts.temperature !== undefined) {
      promptOptions.temperature = opts.temperature;
    }

    const fullPrompt = `${getSystemPrompt(opts)}\n\n${buildUserPrompt(opts)}`;

    console.log(`[chrome] prompt start`);
    const raw = await session.prompt(fullPrompt, promptOptions);
    console.log(`[chrome] prompt result:`, JSON.stringify(raw));

    const data = parseOutput(raw, opts);

    return { data, raw, providerType: "chrome" };
  }

  async function dispose(): Promise<void> {
    if (session) {
      try {
        session.destroy();
      } catch {
        // ignore
      }
      session = null;
    }
  }

  return { name: "chrome", isAvailable, classify, generate, dispose };
}
