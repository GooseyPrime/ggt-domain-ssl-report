import { afterEach, describe, expect, it, vi } from "vitest";
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

import { fetchRdap, registryBaseFor } from "../src/lib/rdap";

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

describe("fetchRdap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to rdap.org when the registry rate-limits the direct lookup", async () => {
    const fallback = { objectClassName: "domain", ldhName: "example.com" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://data.iana.org/rdap/dns.json") {
        return new Response(
          JSON.stringify({
            services: [[["com"], ["https://rdap.verisign.com/com/v1/"]]],
          })
        );
      }
      if (url === "https://rdap.verisign.com/com/v1/domain/example.com") {
        return new Response(JSON.stringify({ errorCode: 429, title: "Too Many Requests" }), {
          status: 429,
        });
      }
      if (url === "https://rdap.org/domain/example.com") {
        return new Response(JSON.stringify(fallback));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRdap("example.com")).resolves.toEqual(fallback);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://data.iana.org/rdap/dns.json",
      "https://rdap.verisign.com/com/v1/domain/example.com",
      "https://rdap.org/domain/example.com",
    ]);
  });

  it("keeps the registry's authoritative not-found response", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://data.iana.org/rdap/dns.json") {
        return new Response(
          JSON.stringify({
            services: [[["com"], ["https://rdap.verisign.com/com/v1/"]]],
          })
        );
      }
      if (url === "https://rdap.verisign.com/com/v1/domain/example.com") {
        return new Response(JSON.stringify({ errorCode: 404, title: "Not Found" }), {
          status: 404,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRdap("example.com")).resolves.toEqual({
      errorCode: 404,
      title: "Not Found",
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      "https://rdap.org/domain/example.com"
    );
  });
});
