import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDomainExpiry, findRegistrar } from "../src/lib/rdap";
import type { RdapDomain } from "../src/lib/types";

const withExp = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/rdap-with-expiration.json"), "utf8")
) as RdapDomain;
const noExp = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/rdap-no-expiration.json"), "utf8")
) as RdapDomain;

describe("RDAP parse", () => {
  const now = new Date("2026-09-20T12:00:00Z");

  it("reads expiration when published", () => {
    const e = parseDomainExpiry(withExp, now);
    expect(e.date).toBe("2027-08-13T04:00:00Z");
    expect(e.source).toBe("rdap-expiration");
    expect(e.message).toBeNull();
  });

  it("does not invent a date when expiration missing", () => {
    const e = parseDomainExpiry(noExp, now);
    expect(e.date).toBeNull();
    expect(e.message).toMatch(/does not publish/i);
  });

  it("extracts registrar", () => {
    const r = findRegistrar(withExp.entities);
    expect(r.name).toBe("Example Registrar");
    expect(r.ianaId).toBe("376");
  });
});
