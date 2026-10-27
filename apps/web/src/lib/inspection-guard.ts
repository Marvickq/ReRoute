import type { MaterialLot } from "@/types";

/**
 * Reasons why this lot may not move to routing/dispatch because of its visual inspection.
 * Empty when there is no inspection, when it is clear, or when a human has resolved it.
 * RETAKE_REQUIRED can never be resolved by a human override: a new, passing image is required.
 */
export function inspectionBlockers(lot: MaterialLot): string[] {
  const insp = lot.inspection;
  if (!insp || !insp.routing_blocked) return [];
  if (insp.resolution && insp.outcome !== "RETAKE_REQUIRED") return [];
  return insp.blocking_reasons.length > 0
    ? insp.blocking_reasons
    : ["Visual inspection unresolved"];
}
