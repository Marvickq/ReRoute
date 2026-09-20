import { NextRequest, NextResponse } from "next/server";
import { getLot, storeSafetyResult, storeRoutingResult } from "@/lib/store";
import { evaluateSafety } from "@/lib/safety";
import { evaluateRouting } from "@/lib/routing";
import { transitionLot, autoApproveVerifications } from "@/lib/lifecycle";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = getLot(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  if (!lot.analysis) {
    return NextResponse.json(
      { error: "Lot must be analyzed before routing" },
      { status: 400 }
    );
  }

  // Always re-evaluate safety to respect inspector unblock overrides and rejected hazard verifications
  const safety = evaluateSafety(lot);

  // If inspector unblocked the lot, honor unblock override
  if (lot.status === "verified" || lot.status === "routing" || lot.status === "routed") {
    safety.blocked = false;
    safety.blocking_reasons = [];
  }

  storeSafetyResult(safety);

  if (safety.blocked) {
    transitionLot(lot, "block", {
      reasons: safety.blocking_reasons,
      actor: "system",
    });
    return NextResponse.json({ safety, routing: null });
  }

  // Auto-approve review & verifications upon passing safety evaluation
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

  return NextResponse.json({
    safety,
    routing,
    lot,
  });
}
