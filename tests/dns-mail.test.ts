import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DnsSnapshot } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  resolveTxt: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: {
    resolveTxt: mocks.resolveTxt,
  },
}));

import { assessMail } from "@/lib/dns-mail";

describe("assessMail", () => {
  const snap: DnsSnapshot = {
    nameservers: [],
    a: [],
    aaaa: [],
    aWww: [],
    mx: ["10 mail.example.com"],
    txt: ["v=spf1 include:_spf.example.com -all"],
    caa: [],
    hostingHint: "Hosting inferred from nameservers only — not authoritative.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not report low risk when DMARC reject uses pct=0", async () => {
    mocks.resolveTxt.mockResolvedValue([["v=DMARC1; p=reject; pct=0"]]);

    const result = await assessMail("example.com", snap);

    expect(result.risk).toBe("elevated");
    expect(result.line).toMatch(/pct=0/i);
  });

  it("does not report low risk when DMARC reject is only partially enforced", async () => {
    mocks.resolveTxt.mockResolvedValue([["v=DMARC1; p=reject; pct=25"]]);

    const result = await assessMail("example.com", snap);

    expect(result.risk).toBe("medium");
    expect(result.line).toMatch(/25%/);
  });
});
