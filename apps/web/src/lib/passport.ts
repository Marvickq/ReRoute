import type { MaterialLot, MaterialPassport } from "@/types";
import { FACILITIES } from "./facilities";

let passportCounter = 1000;

function nextPassportId(lotId: string): string {
  const num = lotId.replace("RL-", "");
  return `RLP-PP-${num}`;
}

export function generatePassport(lot: MaterialLot): MaterialPassport {
  const passportId = lot.passport_id || nextPassportId(lot.lot_id);

  const totalItems = lot.material_items.reduce((sum, item) => sum + item.quantity, 0);

  const materialSummary = lot.material_items.map((item) => ({
    category: item.category,
    quantity: item.quantity,
    condition: item.condition,
    battery_present: item.battery_present,
    components: item.components,
  }));

  const evidence = lot.evidence.map((ev) => ({
    evidence_id: ev.evidence_id,
    type: ev.type,
    filename: ev.original_filename,
    url: ev.url,
  }));

  const aiUnderstanding = {
    items: lot.material_items.map((item) => ({
      item_id: item.item_id,
      category: item.category,
      quantity: item.quantity,
      condition: item.condition,
      battery_present: item.battery_present,
      components: item.components,
      confidence: item.confidence,
      uncertainty_level: item.uncertainty_level,
      evidence_ids: item.evidence_ids,
    })),
    hazard_signals: lot.hazard_signals.map((signal) => ({
      signal_id: signal.signal_id,
      type: signal.type,
      confidence: signal.confidence,
      uncertainty_level: signal.uncertainty_level,
      severity: signal.severity,
      evidence_ids: signal.evidence_ids,
      review_required: signal.review_required,
      verification_status: signal.verification_status,
    })),
    model_used: lot.analysis?.model_used || null,
    analyzed_at: lot.analysis?.analyzed_at || null,
  };

  const verifications = lot.verifications.map((v) => {
    let targetLabel = "Unknown";
    if (v.target_type === "material") {
      const item = lot.material_items.find((i) => i.item_id === v.target_id);
      targetLabel = item ? item.category.replace(/_/g, " ") : v.target_id;
    } else {
      const signal = lot.hazard_signals.find((s) => s.signal_id === v.target_id);
      targetLabel = signal ? signal.type.replace(/_/g, " ") : v.target_id;
    }
    return {
      verification_id: v.verification_id,
      target_type: v.target_type,
      target_id: v.target_id,
      target_label: targetLabel,
      decision: v.decision,
      note: v.note,
      verified_by: v.verified_by,
      verified_at: v.verified_at,
    };
  });

  const safety = lot.safety_result
    ? {
        evaluated: true,
        requires_human_review: lot.safety_result.requires_human_review,
        blocked: lot.safety_result.blocked,
        blocking_reasons: lot.safety_result.blocking_reasons,
        special_handling: lot.safety_result.special_handling,
        evaluated_at: lot.safety_result.evaluated_at,
      }
    : {
        evaluated: false,
        requires_human_review: false,
        blocked: false,
        blocking_reasons: [],
        special_handling: [],
        evaluated_at: null,
      };

  let routing;
  if (lot.routing_result) {
    const recommendedFacility = lot.selected_facility_id
      ? FACILITIES.find((f) => f.facility_id === lot.selected_facility_id)
      : null;

    routing = {
      evaluated: true,
      recommended_facility_id: lot.selected_facility_id,
      recommended_facility_name: recommendedFacility?.name || null,
      routing_blocked: lot.routing_result.routing_blocked,
      blocking_reasons: lot.routing_result.blocking_reasons,
      eligible_facilities: lot.routing_result.eligible_facilities.map((e) => {
        const facility = FACILITIES.find((f) => f.facility_id === e.facility_id);
        return {
          facility_id: e.facility_id,
          name: facility?.name || e.facility_id,
          eligible: e.eligible,
          exclusion_reason: e.exclusion_reason,
        };
      }),
      evaluated_at: lot.routing_result.evaluated_at,
    };
  } else {
    routing = {
      evaluated: false,
      recommended_facility_id: null,
      recommended_facility_name: null,
      routing_blocked: false,
      blocking_reasons: [],
      eligible_facilities: [],
      evaluated_at: null,
    };
  }

  const lifecycleEvents = lot.events.map((e) => ({
    event_type: e.event_type,
    timestamp: e.timestamp,
    actor: e.actor,
    metadata: e.metadata,
  }));

  return {
    passport_id: passportId,
    lot_id: lot.lot_id,
    created_at: lot.created_at,
    generated_at: new Date().toISOString(),
    current_status: lot.status,

    material_summary: {
      items: materialSummary,
      total_items: totalItems,
    },

    evidence,

    ai_understanding: aiUnderstanding,

    verifications,

    safety,

    routing,

    lifecycle: {
      current_status: lot.status,
      created_at: lot.created_at,
      updated_at: lot.updated_at,
      dispatched_at: lot.dispatched_at,
      received_at: lot.received_at,
      events: lifecycleEvents,
    },
  };
}
