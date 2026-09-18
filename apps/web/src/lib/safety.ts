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
      if (verification.decision === "confirmed") {
        if (signal.type === "possible_battery_swelling" && signal.severity === "high") {
          blockingReasons.push("Confirmed high-severity battery swelling signal requires inspection");
        }
        if (REQUIRED_VERIFICATION_SIGNALS.includes(signal.type)) {
          requiresHumanReview = false;
        }
      } else if (verification.decision === "rejected") {
        continue;
      } else {
        if (signal.review_required || signal.uncertainty_level === "low") {
          requiresHumanReview = true;
        }
      }
    } else {
      if (REQUIRED_VERIFICATION_SIGNALS.includes(signal.type)) {
        if (signal.confidence < SAFETY_THRESHOLDS.low_confidence_for_review) {
          requiresHumanReview = true;
        }
      }

      if (signal.review_required) {
        requiresHumanReview = true;
      }

      if (signal.type === "possible_battery_swelling" && signal.severity === "high") {
        blockingReasons.push("High-severity battery swelling signal requires inspection");
      }
    }
  }

  for (const item of lot.material_items) {
    if (item.uncertainty_level === "low") {
      const verification = lot.verifications.find(
        (v) => v.target_type === "material" && v.target_id === item.item_id
      );
      if (!verification) {
        requiresHumanReview = true;
      }
    }
  }

  if (requiresHumanReview) {
    const allHazardVerified = lot.hazard_signals.every((signal) =>
      lot.verifications.some(
        (v) => v.target_type === "hazard" && v.target_id === signal.signal_id
      )
    );
    const allMaterialVerified = lot.material_items
      .filter((item) => item.uncertainty_level === "low")
      .every((item) =>
        lot.verifications.some(
          (v) => v.target_type === "material" && v.target_id === item.item_id
        )
      );

    if (!allHazardVerified || !allMaterialVerified) {
      blockingReasons.push("Human verification required but not completed");
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
