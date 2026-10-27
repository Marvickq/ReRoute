// Backend enforcement tests for inspection-driven routing blocks.
// Runs the real src/lib modules (lifecycle, safety, inspection-guard) used by the API routes.
// Run: node --import ./tests/register.mjs --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { transitionLot } from "../src/lib/lifecycle.ts";
import { evaluateSafety } from "../src/lib/safety.ts";
import { inspectionBlockers } from "../src/lib/inspection-guard.ts";

function inspection(over = {}) {
  return {
    inspection_id: "INS-1", lot_id: "RL-1", source_evidence_id: "EVD-1",
    outcome: "HUMAN_REVIEW_REQUIRED", quality_status: "ACCEPT", quality_metrics: {},
    reasons: ["no objects detected"], routing_blocked: true,
    blocking_reasons: ["Inspection could not establish sufficient visual evidence; human review required before routing"],
    steps: [], iterations: 2, max_iterations: 4, detections: [], evidence_refs: [],
    opencv_version: "5.0.0", detector: "yolov8n.pt", service_available: true, total_ms: 10,
    started_at: "t", finished_at: "t", resolution: null, ...over,
  };
}

function lot(status, insp) {
  return {
    lot_id: "RL-1", created_at: "t", updated_at: "t", status, text_description: null, evidence: [],
    material_items: [], hazard_signals: [], analysis: { lot_id: "RL-1", items: [], hazard_signals: [], analyzed_at: "t", model_used: "x" },
    verification_status: "pending", selected_facility_id: null, passport_id: null, safety_result: null,
    routing_result: null, events: [], verifications: [], inspection: insp, dispatched_at: null, received_at: null,
  };
}

test("lot without an inspection is unaffected", () => {
  assert.deepEqual(inspectionBlockers(lot("analyzed", null)), []);
  assert.equal(evaluateSafety(lot("analyzed", undefined)).blocked, false);
  assert.equal(transitionLot(lot("verified", null), "route").success, true);
});

test("unresolved inspection blocks safety evaluation (and therefore routing)", () => {
  const s = evaluateSafety(lot("analyzed", inspection()));
  assert.equal(s.blocked, true);
  assert.ok(s.blocking_reasons[0].includes("human review required"));
  assert.equal(s.requires_human_review, true);
});

test("unresolved inspection blocks route, dispatch and receive transitions", () => {
  for (const [status, action] of [["verified", "route"], ["routed", "dispatch"], ["dispatched", "receive"]]) {
    const l = lot(status, inspection());
    const r = transitionLot(l, action);
    assert.equal(r.success, false, action);
    assert.match(r.error, /Blocked by visual inspection/);
    assert.equal(l.status, status, "status must not change");
  }
});

test("inspector 'unblock' override cannot clear an unresolved inspection", () => {
  const l = lot("blocked", inspection());
  const r = transitionLot(l, "unblock", { actor: "someone" });
  assert.equal(r.success, false);
  assert.match(r.error, /inspection unresolved/);
  assert.equal(l.status, "blocked");
  assert.equal(l.verifications.length, 0, "no verifications may be fabricated");
});

test("human resolution of HUMAN_REVIEW_REQUIRED lifts the block", () => {
  const l = lot("review_required", inspection({ resolution: { resolved_by: "inspector", resolved_at: "t", note: "checked by hand" } }));
  assert.deepEqual(inspectionBlockers(l), []);
  assert.equal(evaluateSafety(l).blocked, false);
  assert.equal(transitionLot(lot("verified", l.inspection), "route").success, true);
});

test("RETAKE_REQUIRED cannot be lifted even if a resolution object is present", () => {
  const l = lot("review_required", inspection({
    outcome: "RETAKE_REQUIRED", blocking_reasons: ["Image quality unusable - a new photo is required before routing"],
    resolution: { resolved_by: "x", resolved_at: "t", note: "override attempt" },
  }));
  assert.equal(inspectionBlockers(l).length, 1);
  assert.equal(evaluateSafety(l).blocked, true);
  assert.equal(transitionLot(l, "route").success, false);
});

test("inspection with routing_blocked=false (ready for human verification) does not block", () => {
  const l = lot("verified", inspection({ outcome: "READY_FOR_HUMAN_VERIFICATION", routing_blocked: false, blocking_reasons: [] }));
  assert.deepEqual(inspectionBlockers(l), []);
  assert.equal(transitionLot(l, "route").success, true);
});

test("unresolved safety-critical finding from the inspection blocks with its own reason", () => {
  const l = lot("analyzed", inspection({
    blocking_reasons: ["Unresolved safety-critical finding: battery (confidence 0.30) needs physical inspection"],
  }));
  const s = evaluateSafety(l);
  assert.ok(s.blocking_reasons.some((r) => r.includes("safety-critical")));
});
