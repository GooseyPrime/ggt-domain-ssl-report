import { describe, expect, it } from "vitest";
import { daysUntil, shouldWarn, WARN_DAYS } from "../src/lib/expiry";

describe("expiry warning", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("warns when ≤ 30 days left", () => {
    const iso = new Date(now.getTime() + 10 * 86400000).toISOString();
    const d = daysUntil(iso, now);
    expect(d).toBe(10);
    expect(shouldWarn(d)).toBe(true);
  });

  it("does not warn when > 30 days", () => {
    const iso = new Date(now.getTime() + (WARN_DAYS + 5) * 86400000).toISOString();
    const d = daysUntil(iso, now);
    expect(shouldWarn(d)).toBe(false);
  });

  it("warns when already expired", () => {
    const iso = new Date(now.getTime() - 2 * 86400000).toISOString();
    const d = daysUntil(iso, now);
    expect(d).toBeLessThan(0);
    expect(shouldWarn(d)).toBe(true);
  });

  it("null days never warn", () => {
    expect(shouldWarn(null)).toBe(false);
  });
});
