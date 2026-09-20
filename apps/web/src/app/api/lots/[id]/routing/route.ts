import { NextRequest, NextResponse } from "next/server";
import { getLotAsync, storeSafetyResult, storeRoutingResult, syncLotToCloud } from "@/lib/store";
import { evaluateSafety } from "@/lib/safety";
import { evaluateRouting } from "@/lib/routing";
import { transitionLot, autoApproveVerifications } from "@/lib/lifecycle";

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

  // If safety evaluation flags hazardous conditions, mark lot as blocked and display unblock action
  if (safety.blocked && lot.status !== "routed" && lot.status !== "dispatched" && lot.status !== "received") {
    transitionLot(lot, "block", {
      reasons: safety.blocking_reasons,
      actor: "system",
    });
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

  syncLotToCloud(lot);

  return NextResponse.json({
    safety,
    routing,
    lot,
  });
}
