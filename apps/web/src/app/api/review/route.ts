import { NextResponse } from "next/server";
import { getReviewQueue } from "@/lib/store";

export async function GET() {
  const queue = getReviewQueue();
  return NextResponse.json({ queue });
}
