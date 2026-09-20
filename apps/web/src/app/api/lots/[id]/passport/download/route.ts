import { NextRequest, NextResponse } from "next/server";
import { getLotAsync } from "@/lib/store";
import { generatePassport } from "@/lib/passport";
import { generatePassportHTML } from "@/lib/pdf-generator";

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
    const html = generatePassportHTML(passport);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="Passport-${passport.passport_id}.html"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Passport export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
