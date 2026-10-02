import { NextRequest, NextResponse } from "next/server";
import { paidReport } from "@/lib/report";
import { verifySale } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Paid multi-domain report. Requires a checkout session that the shop confirms as
 * paid for domain-ssl-report; there is no bypass.
 */
export async function POST(req: NextRequest) {
  let body: { domains?: unknown; sessionId?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const verified = await verifySale(sessionId);
  if (!verified.paid) {
    return NextResponse.json(
      {
        error: "Unlock the full report to run this check.",
        code: "PAYMENT_REQUIRED",
      },
      { status: 402 }
    );
  }
  const domains = Array.isArray(body.domains)
    ? body.domains.filter((d): d is string => typeof d === "string")
    : [];
  try {
    return NextResponse.json(await paidReport(domains));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Report failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
