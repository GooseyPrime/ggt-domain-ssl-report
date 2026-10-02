import { TOOL_ID, shopOrigin, toolPublicUrl } from "./shop";

export type SaleResult =
  | { ok: true; checkoutUrl: string; sessionId?: string }
  | { ok: false; message: string };

export type VerifyResult = {
  ok: boolean;
  paid: boolean;
  message?: string;
  sessionId?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Start checkout through the shop sale desk (POST /api/sale). Stripe lives only on the shop. */
export async function startSale(): Promise<SaleResult> {
  try {
    const res = await fetch(`${shopOrigin()}/api/sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url: toolPublicUrl(), product: TOOL_ID, toolId: TOOL_ID }),
      cache: "no-store",
    });
    const data = await readJson(res);
    const checkoutUrl = data ? (asString(data.url) ?? asString(data.checkoutUrl)) : undefined;
    if (res.ok && data?.ok === true && checkoutUrl) {
      return { ok: true, checkoutUrl, sessionId: asString(data.sessionId) };
    }
    return {
      ok: false,
      message: (data && asString(data.message)) || "We could not start checkout. Please try again.",
    };
  } catch {
    return { ok: false, message: "We could not reach checkout. Please try again." };
  }
}

/**
 * Confirm a checkout session with the shop. Paid only when the shop says ok + paid
 * (or a $0 promo) AND the session is for this product — never another SKU's session.
 */
export async function verifySale(sessionId: string): Promise<VerifyResult> {
  if (!sessionId) {
    return { ok: false, paid: false, message: "Missing checkout reference." };
  }
  try {
    const url = new URL(`${shopOrigin()}/api/verify`);
    url.searchParams.set("session_id", sessionId);
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await readJson(res);
    if (!data) {
      return { ok: false, paid: false, message: "The shop did not confirm this purchase." };
    }
    const product = asString(data.product) ?? asString(data.productId) ?? asString(data.toolId);
    const status = asString(data.paymentStatus);
    const paidFlag = data.paid === true || status === "no_payment_required";
    const paid = res.ok && data.ok === true && paidFlag && product === TOOL_ID;
    return {
      ok: paid,
      paid,
      sessionId,
      message: paid
        ? undefined
        : data.ok === true && paidFlag && product !== TOOL_ID
          ? "That checkout is for a different product."
          : asString(data.message) || "Payment not completed.",
    };
  } catch {
    return { ok: false, paid: false, message: "Could not reach the shop payment desk." };
  }
}
