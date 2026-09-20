import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DnsSnapshot,
  MailSpoofAssessment,
  RedirectMatrix,
  RegistrarInfo,
  TlsDetails,
} from "@/lib/types";

const mocks = vi.hoisted(() => ({
  fetchRdap: vi.fn(),
  findRegistrar: vi.fn(),
  parseDomainExpiry: vi.fn(),
  fetchTls: vi.fn(),
  certExpiryFromTls: vi.fn(),
  fetchDns: vi.fn(),
  assessMail: vi.fn(),
  fetchRedirects: vi.fn(),
  buildIcs: vi.fn(() => "BEGIN:VCALENDAR"),
}));

vi.mock("@/lib/rdap", () => ({
  fetchRdap: mocks.fetchRdap,
  findRegistrar: mocks.findRegistrar,
  parseDomainExpiry: mocks.parseDomainExpiry,
}));

vi.mock("@/lib/tls", () => ({
  fetchTls: mocks.fetchTls,
  certExpiryFromTls: mocks.certExpiryFromTls,
}));

vi.mock("@/lib/dns-mail", () => ({
  fetchDns: mocks.fetchDns,
  assessMail: mocks.assessMail,
}));

vi.mock("@/lib/redirects", () => ({
  fetchRedirects: mocks.fetchRedirects,
}));

vi.mock("@/lib/ics", () => ({
  buildIcs: mocks.buildIcs,
}));

import { paidDomainReport } from "@/lib/report";

describe("paidDomainReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the first RDAP and TLS lookup when building the paid report", async () => {
    const tls: TlsDetails = {
      issuer: "Example CA",
      subject: "example.com",
      notBefore: "2026-01-01T00:00:00.000Z",
      notAfter: "2027-01-01T00:00:00.000Z",
      san: ["example.com", "www.example.com"],
      coversBare: true,
      coversWww: true,
      chainSubjects: ["example.com"],
      error: null,
    };
    const dns: DnsSnapshot = {
      nameservers: [],
      a: [],
      aaaa: [],
      aWww: [],
      mx: [],
      txt: [],
      caa: [],
      hostingHint: "Hosted elsewhere.",
    };
    const redirects: RedirectMatrix = {
      probes: [],
      forcesHttps: true,
      note: "HTTP appears to hand off to HTTPS (redirect and/or HSTS).",
    };
    const registrar: RegistrarInfo = {
      name: "Registrar",
      ianaId: "1",
      renewHint: "Renew with your registrar.",
    };
    const mail: MailSpoofAssessment = {
      spf: null,
      dmarc: null,
      mx: [],
      risk: "unknown",
      line: "Mail posture unknown.",
      dkimNote: "DKIM not checked here.",
    };
    const domainExpiry = {
      date: "2027-06-01T00:00:00.000Z",
      message: null,
      daysLeft: 200,
      source: "rdap-expiration" as const,
      warn: false,
    };
    const certExpiry = {
      date: "2027-01-01T00:00:00.000Z",
      message: null,
      daysLeft: 100,
      source: "tls-leaf" as const,
      warn: false,
    };

    mocks.fetchRdap.mockResolvedValue({ entities: [] });
    mocks.fetchTls.mockResolvedValue(tls);
    mocks.fetchDns.mockResolvedValue(dns);
    mocks.fetchRedirects.mockResolvedValue(redirects);
    mocks.findRegistrar.mockReturnValue(registrar);
    mocks.assessMail.mockResolvedValue(mail);
    mocks.parseDomainExpiry.mockReturnValue(domainExpiry);
    mocks.certExpiryFromTls.mockReturnValue(certExpiry);

    const result = await paidDomainReport("example.com", new Date("2026-09-20T00:00:00.000Z"));

    expect(mocks.fetchRdap).toHaveBeenCalledTimes(1);
    expect(mocks.fetchTls).toHaveBeenCalledTimes(1);
    expect(result.free.domainExpiry).toEqual(domainExpiry);
    expect(result.free.certExpiry).toEqual(certExpiry);
    expect(result.domain).toBe("example.com");
  });
});
