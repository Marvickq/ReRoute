import { NextRequest, NextResponse } from "next/server";
import { createLot, getAllLotsAsync } from "@/lib/store";
import { CreateLotRequest } from "@/types";

export async function GET() {
  const lots = await getAllLotsAsync();
  return NextResponse.json({ lots });
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateLotRequest = await request.json();

    if (!body.evidence_ids || body.evidence_ids.length === 0) {
      if (!body.text || body.text.trim().length === 0) {
        return NextResponse.json(
          { error: "At least one evidence item (photo, voice, or text description) is required." },
          { status: 400 }
        );
      }
    }

    const lot = createLot(body.text?.trim() || null, body.evidence_ids || []);

    return NextResponse.json({ lot }, { status: 201 });
  } catch (error) {
    console.error("Create lot error:", error);
    return NextResponse.json({ error: "Failed to create lot" }, { status: 500 });
  }
}
