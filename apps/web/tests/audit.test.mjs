// Audit trail tests (run the real src/lib/audit.ts).
// Run: node --import ./tests/register.mjs --test tests/audit.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appendAudit, auditInspection, verifyAuditChain } from "../src/lib/audit.ts";
import { transitionLot } from "../src/lib/lifecycle.ts";

const lot = () => ({ lot_id: "RL-9", status: "analyzed", events: [], verifications: [], material_items: [], hazard_signals: [], analysis: {}, evidence: [] });

const record = (over = {}) => ({
  inspection_id: "INS-9", lot_id: "RL-9", source_evidence_id: "EVD-SRC", outcome: "RETAKE_REQUIRED",
  quality_status: "ACCEPT", reasons: ["cell phone cut off at the top edge"], routing_blocked: true,
  blocking_reasons: ["Evidence gap: a targeted retake is required before routing"],
  evidence_requests: [{ kind: "wider_view", instruction: "retake from further away", reason: "truncated" }],
  steps: [
    { iteration: 1, timestamp: "2026-01-01T00:00:00Z", observation: { quality_status: "ACCEPT", detections: null },
      decision: "image quality ACCEPT; no detections yet", action: "run_detection",
      tool_calls: [{ tool: "opencv.assess_image_quality", args: {}, result: { status: "ACCEPT" }, latency_ms: 3 },
                   { tool: "yolo.detect", args: { conf: null }, result: [{ class_name: "cell phone", confidence: 0.71 }], latency_ms: 400 }],
      outcome: "1 detection(s)", latency_ms: 410 },
    { iteration: 2, timestamp: "2026-01-01T00:00:01Z", observation: { quality_status: "ACCEPT", detections: [{ class_name: "cell phone" }] },
      decision: "cell phone bounding box touches the top image edge (truncated view)", action: "request_targeted_retake",
      tool_calls: [], outcome: "stopped: targeted retake requested", latency_ms: 1 },
  ],
  evidence_refs: [{ ref_id: "EVD-ANN", kind: "annotated" }, { ref_id: "EVD-CROP1", kind: "crop" }],
  opencv_version: "5.0.0", detector: "yolov8n.pt", service_available: true, ...over,
});

test("every observation, decision, tool call, action and result is logged in order", () => {
  const l = lot();
  auditInspection(l, record());
  assert.deepEqual(l.audit_trail.map((e) => e.type), [
    "observation", "decision", "tool_call", "tool_call", "action", "result",
    "observation", "decision", "action", "result", "inspection_outcome",
  ]);
  assert.equal(l.audit_trail.filter((e) => e.type === "tool_call").map((e) => e.summary).join("|"),
    "Step 1: opencv.assess_image_quality|Step 1: yolo.detect");
  assert.ok(l.audit_trail.every((e) => e.inspection_id === "INS-9" && e.evidence_refs.includes("EVD-SRC")));
});

test("inspection outcome links source evidence, derived evidence and the evidence requests", () => {
  const l = lot();
  auditInspection(l, record());
  const out = l.audit_trail.at(-1);
  assert.deepEqual(out.evidence_refs, ["EVD-SRC", "EVD-ANN", "EVD-CROP1"]);
  assert.equal(out.details.evidence_requests[0].kind, "wider_view");
  assert.equal(out.details.opencv_version, "5.0.0");
});

test("human approval and routing decision join the same chain and reference the evidence", () => {
  const l = lot();
  auditInspection(l, record({ outcome: "HUMAN_REVIEW_REQUIRED", evidence_requests: [] }));
  appendAudit(l, { type: "human_approval", actor: "inspector-1", inspection_id: "INS-9",
    summary: "Human recorded physical inspection", details: { note: "opened casing, no swelling" }, evidence_refs: ["EVD-SRC", "EVD-ANN"] });
  appendAudit(l, { type: "routing_decision", actor: "system:routing-engine", inspection_id: "INS-9",
    summary: "Routing approved", details: { inspection_resolved_by: "inspector-1" }, evidence_refs: ["EVD-SRC", "EVD-ANN"] });
  assert.deepEqual(l.audit_trail.slice(-2).map((e) => e.type), ["human_approval", "routing_decision"]);
  assert.equal(l.audit_trail.at(-1).details.inspection_resolved_by, l.audit_trail.at(-2).actor);
  assert.deepEqual(verifyAuditChain(l), { valid: true, broken_at: null });
});

test("editing, deleting or reordering an entry is detected", () => {
  const build = () => { const l = lot(); auditInspection(l, record()); return l; };
  let l = build();
  assert.equal(verifyAuditChain(l).valid, true);
  l.audit_trail[3].details.result = [{ class_name: "battery", confidence: 0.99 }];
  assert.deepEqual(verifyAuditChain(l), { valid: false, broken_at: 4 });
  l = build(); l.audit_trail.splice(2, 1);
  assert.equal(verifyAuditChain(l).valid, false);
  l = build(); [l.audit_trail[1], l.audit_trail[2]] = [l.audit_trail[2], l.audit_trail[1]];
  assert.equal(verifyAuditChain(l).valid, false);
});

test("backend refuses dispatch while the retake evidence gap is open, and that refusal can be audited", () => {
  const l = lot();
  l.status = "routed";
  l.inspection = record();
  const r = transitionLot(l, "dispatch", { actor: "operator" });
  assert.equal(r.success, false);
  appendAudit(l, { type: "enforcement_block", actor: "operator", inspection_id: "INS-9", summary: `Refused dispatch: ${r.error}`, evidence_refs: ["EVD-SRC"] });
  assert.match(l.audit_trail.at(-1).summary, /Blocked by visual inspection/);
});
