import { NextResponse } from "next/server";
import { startSale } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Starts a shop checkout for this tool. Returns { ok, url } for the browser to follow. */
export async function POST() {
  const result = await startSale();
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 502 });
  }
  return NextResponse.json({ ok: true, url: result.checkoutUrl, sessionId: result.sessionId });
}
