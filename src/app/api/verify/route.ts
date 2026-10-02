import { NextResponse } from "next/server";
import { verifySale } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms a shop checkout session is paid for this product. */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const result = await verifySale(sessionId);
  return NextResponse.json(result, { status: result.paid ? 200 : 402 });
}
