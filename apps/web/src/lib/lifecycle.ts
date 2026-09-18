import type { LotStatus, MaterialLot, Event } from "@/types";

export type LifecycleAction =
  | "analyze"
  | "review"
  | "verify"
  | "route"
  | "dispatch"
  | "receive"
  | "block"
  | "unblock";

const VALID_TRANSITIONS: Record<LotStatus, LotStatus[]> = {
  created: ["analyzing", "blocked"],
  analyzing: ["analyzed", "analysis_failed", "blocked"],
  analyzed: ["review_required", "verified", "routing", "blocked"],
  analysis_failed: ["analyzing", "blocked"],
  safety_review: ["review_required", "verified", "routing", "blocked"],
  review_required: ["verified", "blocked"],
  verified: ["routing", "blocked"],
  routing: ["routed", "blocked"],
  routed: ["dispatched", "blocked"],
  dispatched: ["received"],
  received: [],
  blocked: ["review_required", "routing", "routed"],
};

const ACTION_TO_STATUS: Record<LifecycleAction, LotStatus | null> = {
  analyze: "analyzing",
  review: "review_required",
  verify: null,
  route: "routing",
  dispatch: "dispatched",
  receive: "received",
  block: "blocked",
  unblock: null,
};

export interface TransitionResult {
  success: boolean;
  from: LotStatus;
  to: LotStatus | null;
  event: Event | null;
  error: string | null;
}

export function canTransition(currentStatus: LotStatus, targetStatus: LotStatus): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;
}

export function getValidTransitions(currentStatus: LotStatus): LotStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

export function transitionLot(
  lot: MaterialLot,
  action: LifecycleAction,
  metadata: Record<string, unknown> = {}
): TransitionResult {
  const currentStatus = lot.status;

  if (action === "verify") {
    return handleVerify(lot, metadata);
  }

  if (action === "unblock") {
    return handleUnblock(lot, metadata);
  }

  const targetStatus = ACTION_TO_STATUS[action];
  if (!targetStatus) {
    return {
      success: false,
      from: currentStatus,
      to: null,
      event: null,
      error: `Unknown action: ${action}`,
    };
  }

  if (!canTransition(currentStatus, targetStatus)) {
    return {
      success: false,
      from: currentStatus,
      to: null,
      event: null,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
    };
  }

  const eventType = actionToEventType(action, targetStatus);
  const event = createEvent(lot, eventType, metadata);

  lot.status = targetStatus;
  applyTimestamps(lot, action);

  return {
    success: true,
    from: currentStatus,
    to: targetStatus,
    event,
    error: null,
  };
}

function handleVerify(lot: MaterialLot, metadata: Record<string, unknown>): TransitionResult {
  const currentStatus = lot.status;
  const decision = metadata.decision as string;

  if (currentStatus !== "review_required" && currentStatus !== "analyzed") {
    return {
      success: false,
      from: currentStatus,
      to: null,
      event: null,
      error: `Cannot verify from ${currentStatus}`,
    };
  }

  const allVerified = areAllRequiredObservationsVerified(lot);

  if (allVerified) {
    const event = createEvent(lot, "verification_confirmed", metadata);
    lot.status = "verified";
    return {
      success: true,
      from: currentStatus,
      to: "verified",
      event,
      error: null,
    };
  }

  const eventType =
    decision === "confirmed"
      ? "verification_confirmed"
      : decision === "rejected"
      ? "verification_rejected"
      : "verification_undetermined";

  const event = createEvent(lot, eventType, metadata);
  return {
    success: true,
    from: currentStatus,
    to: currentStatus,
    event,
    error: null,
  };
}

function handleUnblock(lot: MaterialLot, metadata: Record<string, unknown>): TransitionResult {
  const currentStatus = lot.status;

  if (currentStatus !== "blocked") {
    return {
      success: false,
      from: currentStatus,
      to: null,
      event: null,
      error: `Cannot unblock from ${currentStatus}`,
    };
  }

  const allVerified = areAllRequiredObservationsVerified(lot);
  const hasAnalysis = lot.analysis !== null;

  let targetStatus: LotStatus;
  if (allVerified && hasAnalysis) {
    targetStatus = "verified";
  } else if (hasAnalysis) {
    targetStatus = "review_required";
  } else {
    targetStatus = "created";
  }

  const event = createEvent(lot, "lot_unblocked", {
    ...metadata,
    target_status: targetStatus,
  });

  lot.status = targetStatus;
  return {
    success: true,
    from: currentStatus,
    to: targetStatus,
    event,
    error: null,
  };
}

export function areAllRequiredObservationsVerified(lot: MaterialLot): boolean {
  if (!lot.analysis) return false;

  const needsReview = (lot.material_items.some(
    (item) => item.uncertainty_level === "low" || item.uncertainty_level === "medium"
  ) || lot.hazard_signals.some(
    (signal) => signal.review_required || signal.uncertainty_level === "low" || signal.uncertainty_level === "medium"
  ));

  if (!needsReview) return true;

  const materialVerified = lot.material_items
    .filter((item) => item.uncertainty_level === "low" || item.uncertainty_level === "medium")
    .every((item) =>
      lot.verifications.some((v) => v.target_type === "material" && v.target_id === item.item_id)
    );

  const hazardVerified = lot.hazard_signals
    .filter((signal) => signal.review_required || signal.uncertainty_level === "low" || signal.uncertainty_level === "medium")
    .every((signal) =>
      lot.verifications.some((v) => v.target_type === "hazard" && v.target_id === signal.signal_id)
    );

  return materialVerified && hazardVerified;
}

function actionToEventType(action: LifecycleAction, targetStatus: LotStatus): Event["event_type"] {
  switch (action) {
    case "analyze":
      return "ai_analyzed";
    case "review":
      return "review_requested";
    case "route":
      return "routing_completed";
    case "dispatch":
      return "lot_dispatched";
    case "receive":
      return "lot_received";
    case "block":
      return "lot_blocked";
    default:
      return "lot_created";
  }
}

function createEvent(
  lot: MaterialLot,
  eventType: Event["event_type"],
  metadata: Record<string, unknown>
): Event {
  return {
    event_id: `EVT-${Date.now()}-${lot.events.length + 1}`,
    lot_id: lot.lot_id,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    actor: metadata.actor as string || "system",
    metadata,
  };
}

function applyTimestamps(lot: MaterialLot, action: LifecycleAction): void {
  const now = new Date().toISOString();
  lot.updated_at = now;

  if (action === "dispatch") {
    lot.dispatched_at = now;
  } else if (action === "receive") {
    lot.received_at = now;
  }
}

export function getLifecycleSteps(lot: MaterialLot): Array<{
  label: string;
  status: "done" | "active" | "pending" | "failed";
  timestamp?: string;
}> {
  const steps = [
    { label: "Captured", status: "done" as const, timestamp: lot.created_at },
    { label: "Analyzed", status: getStatus(lot, ["analyzed", "review_required", "verified", "routing", "routed", "dispatched", "received"]) },
    { label: "Review", status: getReviewStatus(lot) },
    { label: "Verified", status: getStatus(lot, ["verified", "routing", "routed", "dispatched", "received"]) },
    { label: "Safety", status: getSafetyStatus(lot) },
    { label: "Routed", status: getStatus(lot, ["routed", "dispatched", "received"]) },
    { label: "Dispatched", status: getStatus(lot, ["dispatched", "received"]) },
    { label: "Received", status: getStatus(lot, ["received"]) },
  ];

  if (lot.status === "analysis_failed") {
    steps[1] = { label: "Analyzed", status: "failed" };
  }
  if (lot.status === "safety_review") {
    steps[4] = { label: "Safety", status: "active" };
  }
  if (lot.status === "blocked") {
    const activeIndex = steps.findIndex((s) => s.status === "pending");
    if (activeIndex >= 0) {
      steps[activeIndex] = { label: steps[activeIndex].label, status: "failed" };
    }
  }

  return steps;
}

function getStatus(lot: MaterialLot, activeStatuses: LotStatus[]): "done" | "active" | "pending" {
  if (activeStatuses.includes(lot.status)) return "done";
  const activeIdx = activeStatuses[0];
  const currentIdx = Object.keys(VALID_TRANSITIONS).indexOf(lot.status);
  const targetIdx = Object.keys(VALID_TRANSITIONS).indexOf(activeIdx);
  if (currentIdx < targetIdx) return "pending";
  return "pending";
}

function getReviewStatus(lot: MaterialLot): "done" | "active" | "pending" | "failed" {
  if (lot.status === "review_required") return "active";
  if (["verified", "routing", "routed", "dispatched", "received"].includes(lot.status)) return "done";
  if (lot.status === "blocked") return "failed";
  return "pending";
}

function getSafetyStatus(lot: MaterialLot): "done" | "active" | "pending" | "failed" {
  if (lot.safety_result?.blocked) return "failed";
  if (lot.safety_result) return "done";
  if (["routing", "routed", "dispatched", "received"].includes(lot.status)) return "done";
  return "pending";
}
