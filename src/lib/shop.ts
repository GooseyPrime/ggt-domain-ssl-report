/**
 * Price / checkout helpers. Price source of truth is shop config via env.
 * NEVER hardcode a dollar amount as the UI source of truth.
 */

export function displayPrice(): string {
  const raw = process.env.NEXT_PUBLIC_GGT_PRICE?.trim();
  if (!raw) return "from shop";
  if (raw.toLowerCase() === "from shop") return "from shop";
  if (raw.startsWith("$")) return raw;
  // Allow "9" or "9.00" from shop config
  if (/^\d+(\.\d{1,2})?$/.test(raw)) return `$${raw}`;
  return raw;
}

export function shopOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SHOP_ORIGIN?.replace(/\/$/, "") ||
    "https://goldengoosetools.com"
  );
}

export function shopSku(): string {
  return process.env.NEXT_PUBLIC_GGT_SKU?.trim() || "domain-ssl-report";
}

/** Checkout URL on the shop (shop owns Stripe). */
export function checkoutUrl(returnPath?: string): string {
  const origin = shopOrigin();
  const sku = encodeURIComponent(shopSku());
  const ret = returnPath
    ? `&return=${encodeURIComponent(returnPath)}`
    : "";
  return `${origin}/api/checkout?sku=${sku}${ret}`;
}

/**
 * Payment gate stub for local / pre-shop verify.
 * Production: call shop verify endpoint; this only checks:
 *   - query ?paid=1
 *   - cookie ggt_paid=1
 *   - env GGT_PAID_STUB=1 (server)
 * Documented as placeholder — shop-verify lands later.
 */
export function isPaidStub(opts: {
  searchParams?: URLSearchParams | null;
  cookieHeader?: string | null;
}): boolean {
  if (process.env.GGT_PAID_STUB === "1") return true;
  if (opts.searchParams?.get("paid") === "1") return true;
  const cookie = opts.cookieHeader ?? "";
  if (/(?:^|;\s*)ggt_paid=1(?:;|$)/.test(cookie)) return true;
  return false;
}
