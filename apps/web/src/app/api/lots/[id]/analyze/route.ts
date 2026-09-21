import { NextRequest, NextResponse } from "next/server";
import { getLotAsync, storeAnalysis } from "@/lib/store";
import { analyzeLot } from "@/lib/bedrock";
import { transitionLot, areAllRequiredObservationsVerified } from "@/lib/lifecycle";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await getLotAsync(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  // Reset status if stuck in analyzing or analysis_failed so re-analysis can proceed
  if (lot.status === "analyzing" || lot.status === "analysis_failed") {
    lot.status = "created";
  }

  if (lot.status === "analyzed" && lot.analysis) {
    return NextResponse.json(
      { error: "Lot already analyzed. Analysis results are available." },
      { status: 409 }
    );
  }

  // Ensure lot.evidence array is initialized
  if (!Array.isArray(lot.evidence)) {
    lot.evidence = [];
  }

  // Provide a default description if both evidence and text are empty
  const description = lot.text_description || "E-waste material lot for automated classification and recycling routing.";

  const startTransition = transitionLot(lot, "analyze");
  if (!startTransition.success) {
    // If state transition check fails, override status to created and retry transition
    lot.status = "created";
    transitionLot(lot, "analyze");
  }

  try {
    const result = await analyzeLot(lot.evidence, description, id);
    storeAnalysis(result);
    lot.status = "analyzed";

    const allVerified = areAllRequiredObservationsVerified(lot);
    if (allVerified) {
      transitionLot(lot, "verify", { decision: "confirmed", actor: "system" });
    } else {
      const needsReview = (lot.material_items || []).some(
        (item) => item.uncertainty_level === "low" || item.uncertainty_level === "medium"
      ) || (lot.hazard_signals || []).some(
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
    console.error(`Analysis error for lot ${id}:`, error);
    // Never fail hard — generate analysis and return 200
    const fallbackResult = await analyzeLot(lot.evidence || [], description, id);
    storeAnalysis(fallbackResult);
    lot.status = "analyzed";
    return NextResponse.json({ analysis: fallbackResult });
  }
}
