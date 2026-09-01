import type { ClassificationResult, LLMProvider, ProgressCallback } from "./types";

export function getFirefoxProvider(
  onProgress?: ProgressCallback,
): LLMProvider {
  let engineReady = false;

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

  async function classify(
    text: string,
    labels: string[],
  ): Promise<ClassificationResult> {
    const browserAny = globalThis as any;
    if (!browserAny.browser?.trial?.ml) {
      throw new Error("Firefox trial.ml not available");
    }

    if (!engineReady) {
      if (onProgress) onProgress({ type: "loading" });

      browserAny.browser.trial.ml.onProgress.addListener((p: any) => {
        if (onProgress && p.type === "downloading") {
          onProgress({ type: "downloading", message: p.statusText });
        }
      });

      await browserAny.browser.trial.ml.createEngine({
        modelHub: "huggingface",
        taskName: "zero-shot-classification",
      });
      engineReady = true;
      if (onProgress) onProgress({ type: "ready" });
    }

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

  async function dispose(): Promise<void> {
    const browserAny = globalThis as any;
    if (browserAny.browser?.trial?.ml) {
      try {
        await browserAny.browser.trial.ml.deleteCachedModels();
      } catch {
        // ignore
      }
    }
    engineReady = false;
  }

  return { name: "firefox", isAvailable, classify, dispose };
}
