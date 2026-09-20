import { describe, expect, it } from "vitest";
import { normalizeDomain } from "@/lib/normalize";

describe("normalizeDomain", () => {
  it("rejects IP literals", () => {
    expect(normalizeDomain("127.0.0.1")).toBeNull();
    expect(normalizeDomain("https://192.168.0.10/login")).toBeNull();
  });

  it("keeps valid hostnames", () => {
    expect(normalizeDomain("https://Example.com/path")).toBe("example.com");
  });
});
