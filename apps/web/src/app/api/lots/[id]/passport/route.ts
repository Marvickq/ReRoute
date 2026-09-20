import { NextRequest, NextResponse } from "next/server";
import { getLotAsync } from "@/lib/store";
import { generatePassport } from "@/lib/passport";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lot = await getLotAsync(id);

  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  try {
    const passport = generatePassport(lot);
    return NextResponse.json({ passport });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passport generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
