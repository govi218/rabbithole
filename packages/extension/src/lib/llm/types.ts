export interface ClassificationResult {
  label: string;
  score: number;
  allScores: { label: string; score: number }[];
}

export interface LLMProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  classify(text: string, labels: string[]): Promise<ClassificationResult>;
  dispose?(): Promise<void>;
}

export type ProviderType = "firefox" | "chrome" | "transformers";

export interface ProgressInfo {
  type: "downloading" | "loading" | "ready";
  progress?: number;
  message?: string;
}

export type ProgressCallback = (info: ProgressInfo) => void;
