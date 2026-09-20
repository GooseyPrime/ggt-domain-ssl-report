import { NextRequest, NextResponse } from "next/server";
import { paidReport } from "@/lib/report";
import { isPaidStub } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paid multi-domain report.
 * Checkout stays gated until shop SALE_PRODUCT_IDS includes domain-ssl-report.
 * Non-production only: ?paid=1, cookie ggt_paid=1, or GGT_PAID_STUB=1.
 */
export async function POST(req: NextRequest) {
  const paid = isPaidStub({
    searchParams: req.nextUrl.searchParams,
    cookieHeader: req.headers.get("cookie"),
  });
  if (!paid) {
    return NextResponse.json(
      {
        error:
          "Paid report is gated until the shop desk allowlist includes domain-ssl-report. Production requires shop verification; local non-production may use the paid stub.",
        code: "PAYMENT_REQUIRED",
      },
      { status: 402 }
    );
  }
  try {
    const body = (await req.json()) as { domains?: string[] };
    const domains = body?.domains ?? [];
    const result = await paidReport(domains);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Report failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
