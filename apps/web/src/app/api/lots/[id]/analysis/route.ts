import { NextRequest, NextResponse } from "next/server";
import { getLot, getAnalysis } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = getLot(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  const analysis = getAnalysis(id);

  if (!analysis) {
    return NextResponse.json(
      { error: "No analysis available for this lot" },
      { status: 404 }
    );
  }

  return NextResponse.json({ analysis });
}
