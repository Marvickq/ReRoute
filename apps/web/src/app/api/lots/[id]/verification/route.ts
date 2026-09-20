import { NextRequest, NextResponse } from "next/server";
import {
  getLot,
  getVerificationsForLot,
  getVerificationForTarget,
  storeVerification,
} from "@/lib/store";
import { transitionLot, areAllRequiredObservationsVerified } from "@/lib/lifecycle";
import type { Verification, VerificationDecision } from "@/types";

const VALID_DECISIONS: VerificationDecision[] = ["confirmed", "rejected", "cannot_determine"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    let body: {
      target_type?: "material" | "hazard";
      target_id?: string;
      decision?: string;
      note?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.target_type || !body.target_id || !body.decision) {
      return NextResponse.json(
        { error: "Missing required fields: target_type, target_id, decision" },
        { status: 400 }
      );
    }

    if (body.target_type !== "material" && body.target_type !== "hazard") {
      return NextResponse.json(
        { error: "target_type must be 'material' or 'hazard'" },
        { status: 400 }
      );
    }

    if (!VALID_DECISIONS.includes(body.decision as VerificationDecision)) {
      return NextResponse.json(
        { error: `decision must be one of: ${VALID_DECISIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const lot = getLot(id);
    if (!lot) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 });
    }

    let targetExists = false;
    if (body.target_type === "material") {
      targetExists = lot.material_items.some((item) => item.item_id === body.target_id);
    } else {
      targetExists = lot.hazard_signals.some((signal) => signal.signal_id === body.target_id);
    }

    if (!targetExists) {
      return NextResponse.json({ error: "Target observation not found" }, { status: 404 });
    }

    const existing = getVerificationForTarget(id, body.target_type, body.target_id);
    if (existing) {
      return NextResponse.json(
        { error: "This observation has already been verified" },
        { status: 409 }
      );
    }

    const verification: Verification = {
      verification_id: `VER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lot_id: id,
      target_type: body.target_type,
      target_id: body.target_id,
      decision: body.decision as VerificationDecision,
      note: body.note || null,
      verified_at: new Date().toISOString(),
      verified_by: "demo_operator",
    };

    try {
      storeVerification(verification);
    } catch {
      return NextResponse.json(
        { error: "Failed to persist verification" },
        { status: 500 }
      );
    }

    const allVerified = areAllRequiredObservationsVerified(lot);
    if (allVerified && (lot.status === "review_required" || lot.status === "analyzed")) {
      try {
        transitionLot(lot, "verify", {
          decision: body.decision,
          actor: "demo_operator",
          target_type: body.target_type,
          target_id: body.target_id,
        });
      } catch (err) {
        console.error("[Verification] Transition error:", err);
      }
    }

    const verifications = getVerificationsForLot(id);

    return NextResponse.json({ verification, verifications }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
