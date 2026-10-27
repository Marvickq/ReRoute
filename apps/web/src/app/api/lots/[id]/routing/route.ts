import { NextRequest, NextResponse } from "next/server";
import { getLotAsync, storeSafetyResult, storeRoutingResult, syncLotToCloud } from "@/lib/store";
import { evaluateSafety } from "@/lib/safety";
import { evaluateRouting } from "@/lib/routing";
import { transitionLot, autoApproveVerifications } from "@/lib/lifecycle";
import { appendAudit } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await getLotAsync(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  if (!lot.analysis) {
    return NextResponse.json(
      { error: "Lot must be analyzed before routing" },
      { status: 400 }
    );
  }

  // Run safety evaluation rule engine
  const safety = evaluateSafety(lot);
  storeSafetyResult(safety);

  // Audit: link the routing decision to the inspection and the evidence it rests on.
  const insp = lot.inspection;
  const evidenceRefs = insp ? [insp.source_evidence_id, ...insp.evidence_refs.map((r) => r.ref_id)] : lot.evidence.map((e) => e.evidence_id);
  const auditRouting = (decision: string, extra: Record<string, unknown>) =>
    appendAudit(lot, {
      type: "routing_decision",
      actor: "system:routing-engine",
      inspection_id: insp?.inspection_id,
      evidence_refs: evidenceRefs,
      summary: `Routing ${decision}`,
      details: {
        inspection_outcome: insp?.outcome ?? null,
        inspection_resolved_by: insp?.resolution?.resolved_by ?? null,
        safety_blocked: safety.blocked,
        blocking_reasons: safety.blocking_reasons,
        ...extra,
      },
    });

  // If safety evaluation flags hazardous conditions, mark lot as blocked and display unblock action
  if (safety.blocked && lot.status !== "routed" && lot.status !== "dispatched" && lot.status !== "received") {
    transitionLot(lot, "block", {
      reasons: safety.blocking_reasons,
      actor: "system",
    });
    auditRouting("blocked", {});
    syncLotToCloud(lot);
    return NextResponse.json({ safety, routing: null, lot });
  }

  // Safety passed or inspector unblock override cleared safety block!
  autoApproveVerifications(lot);
  if (lot.status !== "routed" && lot.status !== "dispatched" && lot.status !== "received") {
    lot.status = "verified";
  }

  const routeTransition = transitionLot(lot, "route");
  if (!routeTransition.success && lot.status !== "routed") {
    lot.status = "routing";
  }

  const routing = evaluateRouting(lot);
  storeRoutingResult(routing);

  if (routing.recommended_facility_id && !routing.routing_blocked) {
    lot.status = "routed";
  }

  auditRouting(routing.recommended_facility_id && !routing.routing_blocked ? "approved" : "not approved", {
    recommended_facility_id: routing.recommended_facility_id,
    routing_blocked: routing.routing_blocked,
  });
  syncLotToCloud(lot);

  return NextResponse.json({
    safety,
    routing,
    lot,
  });
}
