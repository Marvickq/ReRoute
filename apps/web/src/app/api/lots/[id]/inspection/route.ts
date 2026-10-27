import { NextRequest, NextResponse } from "next/server";
import { getEvidence, getLotAsync, syncLotToCloud, addEvent } from "@/lib/store";
import { inspectionBlockers } from "@/lib/inspection";
import { appendAudit, verifyAuditChain } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await getLotAsync(id);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  return NextResponse.json({
    inspection: lot.inspection ?? null,
    history: lot.inspection_history ?? [],
    blockers: inspectionBlockers(lot),
    audit_chain: verifyAuditChain(lot),
  });
}

/**
 * POST { action: "resolve", actor, note }  - human review of a HUMAN_REVIEW_REQUIRED inspection.
 * POST { action: "retake", evidence_id, actor } - attach a new photo; the lot must then be re-analyzed.
 * AI output never resolves an inspection; RETAKE_REQUIRED can only be cleared by a passing new image.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await getLotAsync(id);
  if (!lot) return NextResponse.json({ error: "Lot not found" }, { status: 404 });

  let body: { action?: string; actor?: string; note?: string; evidence_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const insp = lot.inspection;
  if (!insp) return NextResponse.json({ error: "Lot has no inspection record" }, { status: 400 });
  const actor = body.actor?.trim() || "demo_operator";

  if (body.action === "resolve") {
    if (insp.outcome === "RETAKE_REQUIRED") {
      return NextResponse.json(
        { error: "Retake required: the image is unusable. Upload a new photo instead of overriding." },
        { status: 409 }
      );
    }
    if (!body.note || body.note.trim().length < 5) {
      return NextResponse.json(
        { error: "A note describing the human inspection is required (min 5 characters)." },
        { status: 400 }
      );
    }
    insp.resolution = { resolved_by: actor, resolved_at: new Date().toISOString(), note: body.note.trim() };
    addEvent(id, "inspection_resolved", actor, {
      inspection_id: insp.inspection_id,
      outcome: insp.outcome,
      note: insp.resolution.note,
    });
    appendAudit(lot, {
      type: "human_approval",
      actor,
      inspection_id: insp.inspection_id,
      summary: `Human recorded physical inspection resolving ${insp.outcome}`,
      details: { note: insp.resolution.note, resolved_blocking_reasons: insp.blocking_reasons },
      evidence_refs: [insp.source_evidence_id, ...insp.evidence_refs.map((r) => r.ref_id)],
    });
    syncLotToCloud(lot);
    return NextResponse.json({ inspection: insp, blockers: inspectionBlockers(lot) });
  }

  if (body.action === "retake") {
    const ev = body.evidence_id ? getEvidence(body.evidence_id) : undefined;
    if (!ev || ev.type !== "photo") {
      return NextResponse.json({ error: "evidence_id must reference an uploaded photo" }, { status: 400 });
    }
    if (["routed", "dispatched", "received"].includes(lot.status)) {
      return NextResponse.json({ error: `Cannot retake after ${lot.status}` }, { status: 409 });
    }
    // Original evidence is preserved; the new photo is added and listed first so it is inspected next.
    ev.lot_id = lot.lot_id;
    lot.evidence = [ev, ...lot.evidence.filter((e) => e.evidence_id !== ev.evidence_id)];
    lot.analysis = null;
    lot.material_items = [];
    lot.hazard_signals = [];
    lot.safety_result = null;
    lot.routing_result = null;
    lot.status = "created";
    appendAudit(lot, {
      type: "retake",
      actor,
      inspection_id: insp.inspection_id,
      summary: "New photo attached in response to the inspection's retake request",
      details: { requests: insp.evidence_requests ?? [], previous_source: insp.source_evidence_id },
      evidence_refs: [ev.evidence_id],
    });
    addEvent(id, "inspection_retake_requested", actor, {
      previous_inspection_id: insp.inspection_id,
      new_evidence_id: ev.evidence_id,
    });
    syncLotToCloud(lot);
    return NextResponse.json({ lot, next: "POST /api/lots/" + id + "/analyze" });
  }

  return NextResponse.json({ error: "action must be 'resolve' or 'retake'" }, { status: 400 });
}
