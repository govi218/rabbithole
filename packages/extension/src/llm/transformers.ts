import type {
  ClassificationResult,
  GenerateOptions,
  GenerateResult,
  LLMProvider,
  ProgressCallback,
} from "./provider";
import { buildUserPrompt, getSystemPrompt, parseOutput } from "./provider";

const ClassifyModel = "Xenova/distilbert-base-uncased-mnli";
const GenerateModel = "onnx-community/Llama-3.2-1B-Instruct-ONNX";

export function getTransformersProvider(
  onProgress?: ProgressCallback,
): LLMProvider {
  let classifier: any = null;
  let generator: any = null;

  async function isAvailable(): Promise<boolean> {
    return typeof WebAssembly !== "undefined";
  }

  async function setupEnv() {
    const { env } = await import("@huggingface/transformers");
    const chromeAny = globalThis as any;
    const runtime = chromeAny.chrome ?? chromeAny.browser;
    if (runtime?.runtime?.getURL) {
      env.backends.onnx.wasm.wasmPaths = runtime.runtime.getURL("ort/");
    }
  }

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    if (!classifier) {
      if (onProgress) onProgress({ type: "loading" });
      await setupEnv();
      const { pipeline } = await import("@huggingface/transformers");
      classifier = await pipeline("zero-shot-classification", ClassifyModel);
      if (onProgress) onProgress({ type: "ready" });
    }

    const res = await classifier(text, labels);
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
    if (!generator) {
      console.log(`[transformers] loading model: ${GenerateModel} (q4)`);
      if (onProgress) onProgress({ type: "loading" });
      await setupEnv();
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      generator = await pipeline("text-generation", GenerateModel, {
        dtype: "q4",
        progress_callback: (p: any) => {
          console.log(`[transformers] progress:`, p);
          if (onProgress && p.status === "progress") {
            onProgress({ type: "downloading", progress: p.progress, message: p.file });
          }
        },
      });
      console.log(`[transformers] model loaded`);
      if (onProgress) onProgress({ type: "ready" });
    }

    const messages = [
      { role: "system", content: getSystemPrompt(opts) },
      { role: "user", content: buildUserPrompt(opts) },
    ];

    console.log(`[transformers] generate start`, { maxTokens: opts.maxTokens ?? 512 });
    const res = await generator(messages, {
      max_new_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.7,
      do_sample: (opts.temperature ?? 0.7) > 0,
    });
    console.log(`[transformers] generate result:`, res);

    // text-generation returns [{ generated_text: [{ role, content }, ...] }]
    const generated = res[0]?.generated_text;
    let raw: string;
    if (Array.isArray(generated)) {
      const assistantMsg = generated.find((m: any) => m.role === "assistant");
      raw = assistantMsg?.content ?? "";
    } else {
      raw = typeof generated === "string" ? generated : "";
    }

    console.log(`[transformers] raw output:`, JSON.stringify(raw));

    let data: any;
    try {
      data = parseOutput(raw, opts);
    } catch (e) {
      console.error(`[transformers] JSON parse/validation failed`, e);
      console.log(`[transformers] raw output that failed to parse:`, raw);
      throw e;
    }

    return { data, raw, providerType: "transformersjs" };
  }

  async function dispose(): Promise<void> {
    classifier = null;
    generator = null;
  }

  return { name: "transformers", isAvailable, classify, generate, dispose };
}
