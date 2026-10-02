import { afterEach, describe, expect, it, vi } from "vitest";
import { startSale, verifySale } from "@/lib/payments";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
});

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("startSale", () => {
  it("posts the domain-ssl-report product with the tool url to the shop desk", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://shop.example.com/";
    const fn = stubFetch(200, { ok: true, url: "https://checkout.stripe.com/c/x", sessionId: "cs_test_1" });
    const result = await startSale();
    expect(result).toEqual({
      ok: true,
      checkoutUrl: "https://checkout.stripe.com/c/x",
      sessionId: "cs_test_1",
    });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://shop.example.com/api/sale");
    expect(JSON.parse(init.body)).toEqual({
      url: "https://shop.example.com/tools/domain-ssl-report",
      product: "domain-ssl-report",
      toolId: "domain-ssl-report",
    });
  });

  it("surfaces a shop refusal without a checkout url", async () => {
    stubFetch(400, { ok: false, message: "Unknown product." });
    const result = await startSale();
    expect(result).toEqual({ ok: false, message: "Unknown product." });
  });

  it("reports an unreachable shop", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const result = await startSale();
    expect(result.ok).toBe(false);
  });
});

describe("verifySale", () => {
  it("is paid only for ok + paid + matching product", async () => {
    stubFetch(200, { ok: true, paid: true, product: "domain-ssl-report" });
    expect((await verifySale("cs_1")).paid).toBe(true);
  });

  it("rejects a paid session for another product", async () => {
    stubFetch(200, { ok: true, paid: true, product: "quote-invoice" });
    const result = await verifySale("cs_1");
    expect(result.paid).toBe(false);
    expect(result.message).toMatch(/different product/);
  });

  it("rejects when the shop does not name a product", async () => {
    stubFetch(200, { ok: true, paid: true });
    expect((await verifySale("cs_1")).paid).toBe(false);
  });

  it("rejects an unpaid session", async () => {
    stubFetch(402, { ok: false, paid: false, message: "Payment not completed." });
    const result = await verifySale("cs_1");
    expect(result.paid).toBe(false);
    expect(result.message).toBe("Payment not completed.");
  });

  it("rejects a missing session id without calling the shop", async () => {
    const fn = stubFetch(200, {});
    expect((await verifySale("")).paid).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});
