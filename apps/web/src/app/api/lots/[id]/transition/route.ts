import { NextRequest, NextResponse } from "next/server";
import { getLotAsync, syncLotToCloud } from "@/lib/store";
import { transitionLot, type LifecycleAction } from "@/lib/lifecycle";
import { appendAudit } from "@/lib/audit";

const VALID_ACTIONS: LifecycleAction[] = ["dispatch", "receive", "unblock"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { action?: string; actor?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Missing required field: action" }, { status: 400 });
  }

  if (!VALID_ACTIONS.includes(body.action as LifecycleAction)) {
    return NextResponse.json(
      { error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const lot = await getLotAsync(id);
  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  const metadata: Record<string, unknown> = {
    actor: body.actor || "demo_operator",
  };
  if (body.note) {
    metadata.note = body.note;
  }

  if (body.action === "dispatch") {
    const facility = lot.routing_result?.eligible_facilities.find(
      (f) => f.facility_id === lot.selected_facility_id
    );
    metadata.facility_id = lot.selected_facility_id;
    metadata.facility_name = facility ? (facility as unknown as { name: string }).name : null;
  }

  const result = transitionLot(lot, body.action as LifecycleAction, metadata);

  const evidenceRefs = lot.inspection
    ? [lot.inspection.source_evidence_id, ...lot.inspection.evidence_refs.map((r) => r.ref_id)]
    : [];
  if (!result.success) {
    appendAudit(lot, {
      type: "enforcement_block",
      actor: String(metadata.actor),
      inspection_id: lot.inspection?.inspection_id,
      evidence_refs: evidenceRefs,
      summary: `Refused ${body.action}: ${result.error}`,
      details: { from_status: result.from },
    });
    syncLotToCloud(lot);
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  appendAudit(lot, {
    type: "human_approval",
    actor: String(metadata.actor),
    inspection_id: lot.inspection?.inspection_id,
    evidence_refs: evidenceRefs,
    summary: `Operator performed ${body.action} (${result.from} -> ${result.to})`,
    details: { note: body.note ?? null, facility_id: metadata.facility_id ?? null },
  });
  syncLotToCloud(lot);

  return NextResponse.json({
    lot,
    transition: {
      from: result.from,
      to: result.to,
      action: body.action,
      event: result.event,
    },
  });
}
