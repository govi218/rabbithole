import type {
  ClassificationResult,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
  ProgressCallback,
} from "./provider";
import { buildUserPrompt, getSystemPrompt, parseOutput } from "./provider";

const GenerateModel = "onnx-community/Llama-3.2-1B-Instruct-ONNX";

export function getFirefoxProvider(
  onProgress?: ProgressCallback,
): LLMProvider {
  let currentTask: string | null = null;

  async function isAvailable(): Promise<boolean> {
    const browserAny = globalThis as any;
    if (!browserAny.browser?.trial?.ml) {
      try {
        const granted = await browserAny.browser.permissions.request({
          permissions: ["trialML"],
        });
        if (!granted) return false;
      } catch {
        return false;
      }
    }
    return !!browserAny.browser?.trial?.ml;
  }

  async function ensureEngine(taskName: string, modelId?: string) {
    const browserAny = globalThis as any;
    if (currentTask === taskName) return;

    console.log(`[firefox] creating engine: ${taskName}${modelId ? ` (${modelId})` : ""}`);
    if (onProgress) onProgress({ type: "loading" });

    browserAny.browser.trial.ml.onProgress.addListener((p: any) => {
      console.log(`[firefox] progress:`, p);
      if (onProgress && p.type === "downloading") {
        onProgress({ type: "downloading", message: p.statusText });
      }
    });

    const config: any = {
      modelHub: "huggingface",
      taskName,
    };
    if (modelId) config.modelId = modelId;

    console.log(`[firefox] createEngine config:`, config);
    await browserAny.browser.trial.ml.createEngine(config);
    currentTask = taskName;
    console.log(`[firefox] engine ready: ${taskName}`);

    if (onProgress) onProgress({ type: "ready" });
  }

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    const browserAny = globalThis as any;
    if (!browserAny.browser?.trial?.ml) {
      throw new Error("Firefox trial.ml not available");
    }

    await ensureEngine("zero-shot-classification");

    const res = await browserAny.browser.trial.ml.runEngine({
      args: [text, labels],
    });

    const scores = res.scores as number[];
    const allLabels = res.labels as string[];
    const bestIdx = scores.indexOf(Math.max(...scores));

    return {
      label: allLabels[bestIdx],
      score: scores[bestIdx],
      allScores: allLabels.map((label, i) => ({ label, score: scores[i] })),
    };
  }

  async function generate<T = string>(
    opts: GenerateOptions<T>,
  ): Promise<GenerateResult<T>> {
    const browserAny = globalThis as any;
    if (!browserAny.browser?.trial?.ml) {
      throw new Error("Firefox trial.ml not available");
    }

    await ensureEngine("text-generation", GenerateModel);

    const messages = [
      { role: "system", content: getSystemPrompt(opts) },
      { role: "user", content: buildUserPrompt(opts) },
    ];

    console.log(`[firefox] runEngine start`, { messages, maxTokens: opts.maxTokens ?? 512 });
    const res = await browserAny.browser.trial.ml.runEngine({
      args: [messages],
      options: {
        max_new_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
        do_sample: (opts.temperature ?? 0.7) > 0,
      },
    });
    console.log(`[firefox] runEngine result:`, res);

    // text-generation returns [{ generated_text: [{ role, content }, ...] }]
    const generated = res[0]?.generated_text;
    let raw: string;
    if (Array.isArray(generated)) {
      const assistantMsg = generated.find((m: any) => m.role === "assistant");
      raw = assistantMsg?.content ?? "";
    } else {
      raw = typeof generated === "string" ? generated : "";
    }

    console.log(`[firefox] raw output:`, JSON.stringify(raw));

    let data: any;
    try {
      data = parseOutput(raw, opts);
    } catch (e) {
      console.error(`[firefox] JSON parse/validation failed`, e);
      console.log(`[firefox] raw output that failed to parse:`, raw);
      throw e;
    }

    return { data, raw, providerType: "firefox" };
  }

  async function dispose(): Promise<void> {
    const browserAny = globalThis as any;
    if (browserAny.browser?.trial?.ml) {
      try {
        await browserAny.browser.trial.ml.deleteCachedModels();
      } catch {
        // ignore
      }
    }
    currentTask = null;
  }

  return { name: "firefox", isAvailable, classify, generate, dispose };
}
