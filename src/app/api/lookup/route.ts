import { NextRequest, NextResponse } from "next/server";
import { freeLookup } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { domain?: string };
    if (!body?.domain) {
      return NextResponse.json({ error: "Enter a domain like example.com." }, { status: 400 });
    }
    const result = await freeLookup(body.domain);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
