import type { ClassificationResult, LLMProvider, ProgressCallback } from "./types";

export function getTransformersProvider(
  onProgress?: ProgressCallback,
): LLMProvider {
  let classifier: any = null;

  async function isAvailable(): Promise<boolean> {
    return typeof WebAssembly !== "undefined";
  }

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    if (!classifier) {
      if (onProgress) onProgress({ type: "loading" });

      const { pipeline, env } = await import("@huggingface/transformers");

      const chromeAny = globalThis as any;
      const runtime = chromeAny.chrome ?? chromeAny.browser;
      if (runtime?.runtime?.getURL) {
        env.backends.onnx.wasm.wasmPaths = runtime.runtime.getURL("ort/");
      }

      classifier = await pipeline(
        "zero-shot-classification",
        "Xenova/distilbert-base-uncased-mnli",
      );

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

  async function dispose(): Promise<void> {
    classifier = null;
  }

  return { name: "transformers", isAvailable, classify, dispose };
}
