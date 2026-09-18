import { NextRequest, NextResponse } from "next/server";
import { getLot } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = getLot(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  return NextResponse.json({ lot });
}
