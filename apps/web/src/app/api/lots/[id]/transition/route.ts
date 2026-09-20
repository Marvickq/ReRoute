import { NextRequest, NextResponse } from "next/server";
import { getLot } from "@/lib/store";
import { transitionLot, type LifecycleAction } from "@/lib/lifecycle";

const VALID_ACTIONS: LifecycleAction[] = ["dispatch", "receive", "unblock"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { action?: string; actor?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "Missing required field: action" }, { status: 400 });
  }

  if (!VALID_ACTIONS.includes(body.action as LifecycleAction)) {
    return NextResponse.json(
      { error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const lot = getLot(id);
  if (!lot) {
    return NextResponse.json({ error: "Lot not found" }, { status: 404 });
  }

  const metadata: Record<string, unknown> = {
    actor: body.actor || "demo_operator",
  };
  if (body.note) {
    metadata.note = body.note;
  }

  if (body.action === "dispatch") {
    const facility = lot.routing_result?.eligible_facilities.find(
      (f) => f.facility_id === lot.selected_facility_id
    );
    metadata.facility_id = lot.selected_facility_id;
    metadata.facility_name = facility ? (facility as unknown as { name: string }).name : null;
  }

  const result = transitionLot(lot, body.action as LifecycleAction, metadata);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    lot,
    transition: {
      from: result.from,
      to: result.to,
      action: body.action,
      event: result.event,
    },
  });
}
