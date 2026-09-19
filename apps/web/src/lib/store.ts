import {
  MaterialLot,
  Evidence,
  LotStatus,
  VerificationStatus,
  MaterialItem,
  HazardSignal,
  AnalysisResult,
  SafetyResult,
  RoutingResult,
  Event,
  Verification,
  ReviewQueueItem,
} from "@/types";

import { saveLotToDynamoDB, isDynamoDBConfigured } from "./dynamodb";
import { publishReRouteEvent } from "./events";
import { startLotWorkflowInStepFunctions } from "./stepfunctions";

// Use globalThis to persist stores across Next.js dev mode recompilations
const globalStore = globalThis as typeof globalThis & {
  __reloop_lots?: Map<string, MaterialLot>;
  __reloop_evidence?: Map<string, Evidence>;
  __reloop_analysis?: Map<string, AnalysisResult>;
  __reloop_materialItems?: Map<string, MaterialItem>;
  __reloop_hazardSignals?: Map<string, HazardSignal>;
  __reloop_lotCounter?: number;
};

if (!globalStore.__reloop_lotCounter) globalStore.__reloop_lotCounter = 1000;

function nextLotId(): string {
  globalStore.__reloop_lotCounter = (globalStore.__reloop_lotCounter || 1000) + 1;
  return `RL-${globalStore.__reloop_lotCounter}`;
}

const lots = globalStore.__reloop_lots ?? (globalStore.__reloop_lots = new Map<string, MaterialLot>());
const evidenceStore = globalStore.__reloop_evidence ?? (globalStore.__reloop_evidence = new Map<string, Evidence>());
const analysisStore = globalStore.__reloop_analysis ?? (globalStore.__reloop_analysis = new Map<string, AnalysisResult>());
const materialItemStore = globalStore.__reloop_materialItems ?? (globalStore.__reloop_materialItems = new Map<string, MaterialItem>());
const hazardSignalStore = globalStore.__reloop_hazardSignals ?? (globalStore.__reloop_hazardSignals = new Map<string, HazardSignal>());

function syncLotToCloud(lot: MaterialLot): void {
  if (isDynamoDBConfigured()) {
    saveLotToDynamoDB(lot).catch((err) =>
      console.error(`[DynamoDB Sync Error] Failed to sync lot ${lot.lot_id}:`, err)
    );
  }
}

export function createLot(text: string | null, evidenceIds: string[]): MaterialLot {
  const lotId = nextLotId();
  const now = new Date().toISOString();
  const passportId = `RLP-PP-${lotId.replace("RL-", "")}`;

  const evidence = evidenceIds
    .map((id) => evidenceStore.get(id))
    .filter((e): e is Evidence => e !== undefined);

  const lot: MaterialLot = {
    lot_id: lotId,
    created_at: now,
    updated_at: now,
    status: "created",
    text_description: text || null,
    evidence,
    material_items: [],
    hazard_signals: [],
    analysis: null,
    verification_status: "pending",
    selected_facility_id: null,
    passport_id: passportId,
    safety_result: null,
    routing_result: null,
    verifications: [],
    dispatched_at: null,
    received_at: null,
    events: [
      {
        event_id: `EVT-${Date.now()}-created`,
        lot_id: lotId,
        event_type: "lot_created",
        timestamp: now,
        actor: "system",
        metadata: {},
      },
    ],
  };

  lots.set(lotId, lot);
  syncLotToCloud(lot);
  publishReRouteEvent("LotCreated", lotId, {
    status: lot.status,
    evidence_count: evidence.length,
    text_description: text,
  });
  startLotWorkflowInStepFunctions(lotId, {
    passport_id: passportId,
    evidence_count: evidence.length,
  });
  return lot;
}

export function getLot(lotId: string): MaterialLot | undefined {
  return lots.get(lotId);
}

export function getAllLots(): MaterialLot[] {
  return Array.from(lots.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function storeEvidence(evidence: Evidence): void {
  evidenceStore.set(evidence.evidence_id, evidence);
}

export function getEvidence(evidenceId: string): Evidence | undefined {
  return evidenceStore.get(evidenceId);
}

export function deleteEvidence(evidenceId: string): boolean {
  return evidenceStore.delete(evidenceId);
}

export function storeAnalysis(result: AnalysisResult): void {
  const lot = lots.get(result.lot_id);
  if (!lot) return;

  analysisStore.set(result.lot_id, result);

  for (const item of result.items) {
    materialItemStore.set(item.item_id, item);
  }
  for (const signal of result.hazard_signals) {
    hazardSignalStore.set(signal.signal_id, signal);
  }

  lot.material_items = result.items;
  lot.hazard_signals = result.hazard_signals;
  lot.analysis = result;
  addEvent(result.lot_id, "ai_analyzed", "system", {
    model_used: result.model_used,
    items_count: result.items.length,
    hazard_signals_count: result.hazard_signals.length,
  });
  syncLotToCloud(lot);
  publishReRouteEvent("BedrockAnalysisCompleted", result.lot_id, {
    model_used: result.model_used,
    items_count: result.items.length,
    hazard_signals_count: result.hazard_signals.length,
  });
}

export function getAnalysis(lotId: string): AnalysisResult | undefined {
  return analysisStore.get(lotId);
}

export function getMaterialItem(itemId: string): MaterialItem | undefined {
  return materialItemStore.get(itemId);
}

export function getHazardSignal(signalId: string): HazardSignal | undefined {
  return hazardSignalStore.get(signalId);
}

export function storeSafetyResult(result: SafetyResult): void {
  const lot = lots.get(result.lot_id);
  if (!lot) return;
  lot.safety_result = result;
  addEvent(result.lot_id, "safety_review_requested", "system", {
    blocked: result.blocked,
    requires_human_review: result.requires_human_review,
  });
  syncLotToCloud(lot);
  if (result.blocked || result.requires_human_review) {
    publishReRouteEvent("SafetyHazardFlagged", result.lot_id, {
      blocked: result.blocked,
      requires_human_review: result.requires_human_review,
      reasons: result.reasons,
    });
  }
}

export function storeRoutingResult(result: RoutingResult): void {
  const lot = lots.get(result.lot_id);
  if (!lot) return;
  lot.routing_result = result;
  if (result.recommended_facility_id) {
    lot.selected_facility_id = result.recommended_facility_id;
  }
  addEvent(result.lot_id, "routing_completed", "system", {
    recommended_facility_id: result.recommended_facility_id,
    routing_blocked: result.routing_blocked,
  });
  syncLotToCloud(lot);
  publishReRouteEvent("FacilityRouted", result.lot_id, {
    recommended_facility_id: result.recommended_facility_id,
    routing_blocked: result.routing_blocked,
  });
}

export function addEvent(
  lotId: string,
  event_type: Event["event_type"],
  actor: string,
  metadata: Record<string, unknown> = {}
): void {
  const lot = lots.get(lotId);
  if (!lot) return;
  lot.events.push({
    event_id: `EVT-${Date.now()}-${lot.events.length + 1}`,
    lot_id: lotId,
    event_type,
    timestamp: new Date().toISOString(),
    actor,
    metadata,
  });
}

export function storeVerification(verification: Verification): void {
  const lot = lots.get(verification.lot_id);
  if (!lot) return;

  lot.verifications.push(verification);

  if (verification.target_type === "hazard") {
    const signal = lot.hazard_signals.find((s) => s.signal_id === verification.target_id);
    if (signal) {
      signal.verification_status = verification.decision === "confirmed"
        ? "confirmed"
        : verification.decision === "rejected"
        ? "rejected"
        : "cannot_determine";
    }
  }

  const eventType =
    verification.decision === "confirmed"
      ? "verification_confirmed"
      : verification.decision === "rejected"
      ? "verification_rejected"
      : "verification_undetermined";

  addEvent(verification.lot_id, eventType, "human", {
    target_type: verification.target_type,
    target_id: verification.target_id,
    decision: verification.decision,
  });
}

export function getVerificationsForLot(lotId: string): Verification[] {
  const lot = lots.get(lotId);
  return lot ? lot.verifications : [];
}

export function getVerificationForTarget(
  lotId: string,
  targetType: "material" | "hazard",
  targetId: string
): Verification | undefined {
  const lot = lots.get(lotId);
  if (!lot) return undefined;
  return lot.verifications.find(
    (v) => v.target_type === targetType && v.target_id === targetId
  );
}

export function getReviewQueue(): ReviewQueueItem[] {
  const items: ReviewQueueItem[] = [];

  for (const lot of lots.values()) {
    if (!lot.analysis) continue;

    for (const item of lot.material_items) {
      if (item.uncertainty_level === "low" || item.uncertainty_level === "medium") {
        const existing = getVerificationForTarget(lot.lot_id, "material", item.item_id);
        items.push({
          lot_id: lot.lot_id,
          lot_created_at: lot.created_at,
          target_type: "material",
          target_id: item.item_id,
          target_label: item.category.replace(/_/g, " "),
          category: item.category,
          confidence: item.confidence,
          uncertainty_level: item.uncertainty_level,
          evidence_count: item.evidence_ids.length,
          verification_status: existing ? existing.decision : "pending",
          verified_at: existing ? existing.verified_at : null,
        });
      }
    }

    for (const signal of lot.hazard_signals) {
      if (signal.review_required || signal.uncertainty_level === "low" || signal.uncertainty_level === "medium") {
        const existing = getVerificationForTarget(lot.lot_id, "hazard", signal.signal_id);
        items.push({
          lot_id: lot.lot_id,
          lot_created_at: lot.created_at,
          target_type: "hazard",
          target_id: signal.signal_id,
          target_label: signal.type.replace(/_/g, " "),
          category: signal.type,
          confidence: signal.confidence,
          uncertainty_level: signal.uncertainty_level,
          evidence_count: signal.evidence_ids.length,
          verification_status: existing ? existing.decision : "pending",
          verified_at: existing ? existing.verified_at : null,
        });
      }
    }
  }

  return items.sort((a, b) => {
    if (a.verification_status === "pending" && b.verification_status !== "pending") return -1;
    if (a.verification_status !== "pending" && b.verification_status === "pending") return 1;
    return new Date(b.lot_created_at).getTime() - new Date(a.lot_created_at).getTime();
  });
}
