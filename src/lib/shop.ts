/**
 * Price / shop helpers. Price and checkout live on the shop; this tool only
 * displays a label (env) and calls the shop sale desk from its own server routes.
 */

export const TOOL_ID = "domain-ssl-report";
export const TOOL_PATH = "/tools/domain-ssl-report";

export function displayPrice(): string {
  const raw = process.env.NEXT_PUBLIC_GGT_PRICE?.trim();
  if (!raw) return "one-time";
  if (raw.startsWith("$")) return raw;
  if (/^\d+(\.\d{1,2})?$/.test(raw)) return `$${raw}`;
  return raw;
}

export function shopOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SHOP_ORIGIN?.trim().replace(/\/+$/, "") ||
    "https://www.goldengoosetools.com"
  );
}

/** Public URL of this tool on the shop (sent to the desk as the sale target). */
export function toolPublicUrl(): string {
  return `${shopOrigin()}${TOOL_PATH}`;
}
