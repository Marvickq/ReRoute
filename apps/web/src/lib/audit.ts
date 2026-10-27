import { createHash } from "node:crypto";
import type { AuditEntry, AuditEntryType, InspectionRecord, MaterialLot } from "@/types";

const GENESIS = "0".repeat(64);

function hashEntry(e: Omit<AuditEntry, "hash">): string {
  return createHash("sha256")
    .update(
      JSON.stringify([e.seq, e.timestamp, e.actor, e.type, e.inspection_id ?? null, e.summary, e.details, e.evidence_refs, e.prev_hash])
    )
    .digest("hex");
}

/** Append-only, hash-chained audit entry (each entry commits to the previous one). */
export function appendAudit(
  lot: MaterialLot,
  entry: {
    type: AuditEntryType;
    actor: string;
    summary: string;
    details?: Record<string, unknown>;
    evidence_refs?: string[];
    inspection_id?: string;
    timestamp?: string;
  }
): AuditEntry {
  const trail = (lot.audit_trail ||= []);
  const prev = trail[trail.length - 1];
  const base: Omit<AuditEntry, "hash"> = {
    seq: trail.length + 1,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    actor: entry.actor,
    type: entry.type,
    inspection_id: entry.inspection_id,
    summary: entry.summary,
    details: entry.details ?? {},
    evidence_refs: entry.evidence_refs ?? [],
    prev_hash: prev ? prev.hash : GENESIS,
  };
  const full: AuditEntry = { ...base, hash: hashEntry(base) };
  trail.push(full);
  return full;
}

/** Detects edited, removed or reordered entries. */
export function verifyAuditChain(lot: MaterialLot): { valid: boolean; broken_at: number | null } {
  let prev = GENESIS;
  for (const [i, e] of (lot.audit_trail ?? []).entries()) {
    const { hash, ...rest } = e;
    if (e.seq !== i + 1 || e.prev_hash !== prev || hashEntry(rest) !== hash) {
      return { valid: false, broken_at: e.seq };
    }
    prev = hash;
  }
  return { valid: true, broken_at: null };
}

/**
 * Expand an inspection record into audit entries: every observation, decision, tool call, action and result
 * the loop produced, each linked to the source evidence and derived evidence refs.
 */
export function auditInspection(lot: MaterialLot, rec: InspectionRecord): void {
  const common = { inspection_id: rec.inspection_id, actor: "system:inspection-loop" };
  const src = [rec.source_evidence_id];
  for (const s of rec.steps) {
    const ts = s.timestamp;
    appendAudit(lot, { ...common, type: "observation", timestamp: ts, evidence_refs: src,
      summary: `Step ${s.iteration}: quality ${(s.observation as { quality_status?: string }).quality_status ?? "?"}`,
      details: { observation: s.observation } });
    appendAudit(lot, { ...common, type: "decision", timestamp: ts, evidence_refs: src,
      summary: `Step ${s.iteration}: ${s.decision}`, details: { chosen_action: s.action } });
    for (const c of s.tool_calls ?? []) {
      appendAudit(lot, { ...common, type: "tool_call", timestamp: ts, evidence_refs: src,
        summary: `Step ${s.iteration}: ${c.tool}`, details: { args: c.args, result: c.result, latency_ms: c.latency_ms } });
    }
    appendAudit(lot, { ...common, type: "action", timestamp: ts, evidence_refs: src,
      summary: `Step ${s.iteration}: ${s.action}`, details: {} });
    appendAudit(lot, { ...common, type: "result", timestamp: ts, evidence_refs: src,
      summary: `Step ${s.iteration}: ${s.outcome}`, details: { latency_ms: s.latency_ms } });
  }
  appendAudit(lot, { ...common, type: "inspection_outcome",
    evidence_refs: [...src, ...rec.evidence_refs.map((r) => r.ref_id)],
    summary: `Inspection ${rec.outcome}${rec.routing_blocked ? " (routing blocked)" : ""}`,
    details: {
      reasons: rec.reasons, blocking_reasons: rec.blocking_reasons, evidence_requests: rec.evidence_requests ?? [],
      quality_status: rec.quality_status, opencv_version: rec.opencv_version, detector: rec.detector,
      service_available: rec.service_available,
    } });
}
