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

  if (lot.safety_result && lot.routing_result) {
    return NextResponse.json({
      safety: lot.safety_result,
      routing: lot.routing_result,
    });
  }

  const safety = evaluateSafety(lot);
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
  lot.status = "verified";

  const routeTransition = transitionLot(lot, "route");
  if (!routeTransition.success) {
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
  });
}
