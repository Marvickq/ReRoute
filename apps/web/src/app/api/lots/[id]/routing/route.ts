import { NextRequest, NextResponse } from "next/server";
import { getLot, storeSafetyResult, storeRoutingResult } from "@/lib/store";
import { evaluateSafety } from "@/lib/safety";
import { evaluateRouting } from "@/lib/routing";
import { transitionLot, areAllRequiredObservationsVerified } from "@/lib/lifecycle";

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

  const allVerified = areAllRequiredObservationsVerified(lot);
  if (!allVerified) {
    const needsReview = lot.material_items.some(
      (item) => item.uncertainty_level === "low" || item.uncertainty_level === "medium"
    ) || lot.hazard_signals.some(
      (signal) => signal.review_required || signal.uncertainty_level === "low" || signal.uncertainty_level === "medium"
    );

    if (needsReview) {
      return NextResponse.json(
        { error: "Required observations must be verified before routing" },
        { status: 400 }
      );
    }
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

  const routeTransition = transitionLot(lot, "route");
  if (!routeTransition.success) {
    return NextResponse.json({ error: routeTransition.error }, { status: 400 });
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
