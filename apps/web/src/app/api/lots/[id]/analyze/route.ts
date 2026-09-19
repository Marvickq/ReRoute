import { NextRequest, NextResponse } from "next/server";
import { getLot, storeAnalysis } from "@/lib/store";
import { analyzeLot } from "@/lib/bedrock";
import { transitionLot, areAllRequiredObservationsVerified } from "@/lib/lifecycle";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = getLot(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  if (lot.status === "analyzing") {
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 });
  }

  if (lot.status === "analyzed" && lot.analysis) {
    return NextResponse.json(
      { error: "Lot already analyzed. Analysis results are available." },
      { status: 409 }
    );
  }

  if (lot.evidence.length === 0 && !lot.text_description) {
    return NextResponse.json(
      { error: "No evidence to analyze. Add photos, voice, or text description first." },
      { status: 400 }
    );
  }

  const startTransition = transitionLot(lot, "analyze");
  if (!startTransition.success) {
    return NextResponse.json({ error: startTransition.error }, { status: 400 });
  }

  try {
    const result = await analyzeLot(lot.evidence, lot.text_description, id);
    storeAnalysis(result);
    lot.status = "analyzed";

    const allVerified = areAllRequiredObservationsVerified(lot);
    if (allVerified) {
      transitionLot(lot, "verify", { decision: "confirmed", actor: "system" });
    } else {
      const needsReview = lot.material_items.some(
        (item) => item.uncertainty_level === "low" || item.uncertainty_level === "medium"
      ) || lot.hazard_signals.some(
        (signal) => signal.review_required || signal.uncertainty_level === "low" || signal.uncertainty_level === "medium"
      );

      if (needsReview) {
        transitionLot(lot, "review");
      } else {
        transitionLot(lot, "route");
      }
    }

    return NextResponse.json({ analysis: result });
  } catch (error) {
    lot.status = "analysis_failed";
    const message = error instanceof Error ? error.message : "Analysis failed";
    console.error(`Analysis failed for lot ${id}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
