export type UncertaintyLevel = "high" | "medium" | "low";

const UNCERTAINTY_THRESHOLDS = {
  high: 0.8,
  medium: 0.5,
} as const;

export function classifyUncertainty(confidence: number): UncertaintyLevel {
  if (confidence >= UNCERTAINTY_THRESHOLDS.high) return "high";
  if (confidence >= UNCERTAINTY_THRESHOLDS.medium) return "medium";
  return "low";
}

export function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
