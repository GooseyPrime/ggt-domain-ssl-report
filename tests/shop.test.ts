import { afterEach, describe, expect, it } from "vitest";
import { isPaidStub } from "@/lib/shop";

const originalNodeEnv = process.env.NODE_ENV;
const originalStub = process.env.GGT_PAID_STUB;
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  env.NODE_ENV = originalNodeEnv;
  env.GGT_PAID_STUB = originalStub;
});

describe("isPaidStub", () => {
  it("allows local stub signals outside production", () => {
    env.NODE_ENV = "development";
    expect(
      isPaidStub({
        searchParams: new URLSearchParams("paid=1"),
        cookieHeader: null,
      })
    ).toBe(true);
    expect(
      isPaidStub({
        searchParams: null,
        cookieHeader: "ggt_paid=1",
      })
    ).toBe(true);
  });

  it("rejects stub signals in production", () => {
    env.NODE_ENV = "production";
    env.GGT_PAID_STUB = "1";
    expect(
      isPaidStub({
        searchParams: new URLSearchParams("paid=1"),
        cookieHeader: "ggt_paid=1",
      })
    ).toBe(false);
  });
});
