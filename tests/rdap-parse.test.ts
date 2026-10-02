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

import { registryBaseFor } from "../src/lib/rdap";

describe("registryBaseFor", () => {
  const bootstrap = {
    services: [
      [["com", "net"], ["https://rdap.verisign.com/com/v1/"]],
      [["dev"], ["http://example.test/rdap", "https://example.test/rdap"]],
    ] as [string[], string[]][],
  };
  it("finds the registry for a TLD", () => {
    expect(registryBaseFor("github.com", bootstrap)).toBe("https://rdap.verisign.com/com/v1/");
  });
  it("prefers https and adds a trailing slash", () => {
    expect(registryBaseFor("a.dev", bootstrap)).toBe("https://example.test/rdap/");
  });
  it("returns null for unknown TLDs or no bootstrap", () => {
    expect(registryBaseFor("a.zzz", bootstrap)).toBeNull();
    expect(registryBaseFor("a.com", null)).toBeNull();
  });
});
