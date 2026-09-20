import type { MaterialLot, SafetyResult } from "@/types";

const SAFETY_THRESHOLDS = {
  low_confidence_for_review: 0.7,
} as const;

const REQUIRED_VERIFICATION_SIGNALS = [
  "possible_battery_swelling",
  "damaged_lithium",
  "corrosion_detected",
  "leaking_battery",
];

export function evaluateSafety(lot: MaterialLot): SafetyResult {
  const blockingReasons: string[] = [];
  const specialHandling: string[] = [];
  let requiresHumanReview = false;

  const hasBattery = lot.material_items.some((item) => item.battery_present);
  if (hasBattery) {
    specialHandling.push("lithium_battery");
  }

  const batteryItems = lot.material_items.filter((item) => item.category === "battery");
  if (batteryItems.length > 0) {
    specialHandling.push("battery_handling");
  }

  for (const signal of lot.hazard_signals) {
    const verification = lot.verifications.find(
      (v) => v.target_type === "hazard" && v.target_id === signal.signal_id
    );

    if (verification) {
      if (verification.decision === "cannot_determine") {
        blockingReasons.push(
          `Inconclusive hazard signal (${signal.type.replace(/_/g, " ")}) requires physical manual inspection before routing`
        );
      } else if (verification.decision === "confirmed") {
        if (
          REQUIRED_VERIFICATION_SIGNALS.includes(signal.type) ||
          signal.severity === "high" ||
          signal.review_required
        ) {
          blockingReasons.push(
            `Confirmed safety hazard: ${signal.type.replace(/_/g, " ")}${
              signal.severity ? ` (${signal.severity} severity)` : ""
            } requires hazardous material handling clearance`
          );
        }
      } else if (verification.decision === "rejected") {
        // Disproved false positive, clear hazard signal
        continue;
      }
    } else {
      if (REQUIRED_VERIFICATION_SIGNALS.includes(signal.type) || signal.review_required) {
        requiresHumanReview = true;
      }
      if (signal.type === "possible_battery_swelling" || signal.severity === "high") {
        blockingReasons.push(
          `Unverified hazard signal (${signal.type.replace(/_/g, " ")}) requires inspection`
        );
      }
    }
  }

  for (const item of lot.material_items) {
    const verification = lot.verifications.find(
      (v) => v.target_type === "material" && v.target_id === item.item_id
    );

    if (verification) {
      if (verification.decision === "cannot_determine") {
        blockingReasons.push(
          `Inconclusive observation for material item (${item.category.replace(/_/g, " ")}) requires physical inspection`
        );
      }
    } else if (item.uncertainty_level === "low" || item.uncertainty_level === "medium") {
      requiresHumanReview = true;
    }
  }

  if (requiresHumanReview) {
    const unverifiedHazard = lot.hazard_signals.some(
      (signal) =>
        !lot.verifications.some(
          (v) => v.target_type === "hazard" && v.target_id === signal.signal_id
        )
    );
    const unverifiedMaterial = lot.material_items.some(
      (item) =>
        (item.uncertainty_level === "low" || item.uncertainty_level === "medium") &&
        !lot.verifications.some(
          (v) => v.target_type === "material" && v.target_id === item.item_id
        )
    );

    if (unverifiedHazard || unverifiedMaterial) {
      requiresHumanReview = true;
    }
  }

  return {
    lot_id: lot.lot_id,
    requires_human_review: requiresHumanReview,
    blocked: blockingReasons.length > 0,
    blocking_reasons: blockingReasons,
    special_handling: [...new Set(specialHandling)],
    evaluated_at: new Date().toISOString(),
  };
}
