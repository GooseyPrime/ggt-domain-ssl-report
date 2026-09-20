/** Compose free + paid Domain SSL reports. */

import { normalizeDomain } from "./normalize";
import { fetchRdap, findRegistrar, parseDomainExpiry } from "./rdap";
import { certExpiryFromTls, fetchTls } from "./tls";
import { assessMail, fetchDns } from "./dns-mail";
import { fetchRedirects } from "./redirects";
import { buildIcs } from "./ics";
import type {
  FreeLookupResult,
  PaidDomainReport,
  PaidReportResponse,
  RdapDomain,
  TlsDetails,
} from "./types";

function buildFreeLookupResult(
  domain: string,
  rdap: RdapDomain | null,
  tls: TlsDetails,
  now: Date
): FreeLookupResult {
  const domainExpiry = parseDomainExpiry(rdap, now);
  const certExpiry = certExpiryFromTls(tls, now);
  return {
    domain,
    domainExpiry,
    certExpiry,
    anyWarn: domainExpiry.warn || certExpiry.warn,
    lookedUpAt: now.toISOString(),
  };
}

export async function freeLookup(rawDomain: string, now = new Date()): Promise<FreeLookupResult> {
  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    throw new Error("Enter a domain like example.com (we strip https:// and paths).");
  }
  const [rdap, tls] = await Promise.all([fetchRdap(domain), fetchTls(domain)]);
  return buildFreeLookupResult(domain, rdap, tls, now);
}

export async function paidDomainReport(rawDomain: string, now = new Date()): Promise<PaidDomainReport> {
  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    throw new Error("Enter a domain like example.com (we strip https:// and paths).");
  }
  const [rdap, tls, dns, redirects] = await Promise.all([
    fetchRdap(domain),
    fetchTls(domain),
    fetchDns(domain),
    fetchRedirects(domain),
  ]);
  const free = buildFreeLookupResult(domain, rdap, tls, now);
  const registrar = findRegistrar(rdap?.entities);
  const mail = await assessMail(domain, dns);
  const ownerSummary = [
    `${domain}: domain ${free.domainExpiry.date ? `expires ${free.domainExpiry.date}` : free.domainExpiry.message}.`,
    `Certificate ${free.certExpiry.date ? `expires ${free.certExpiry.date}` : free.certExpiry.message}.`,
    registrar.renewHint,
    mail.line,
    redirects.note,
    dns.hostingHint,
  ].join(" ");

  return {
    domain,
    free,
    registrar,
    tls: {
      ...tls,
      coversBare: tls.san.includes(domain) || tls.san.some((s) => s === domain),
      coversWww:
        tls.san.includes(`www.${domain}`) ||
        tls.san.some((s) => s.startsWith("*.") && `www.${domain}`.endsWith(s.slice(1))),
    },
    dns,
    mail,
    redirects,
    ownerSummary,
  };
}

export async function paidReport(rawDomains: string[], now = new Date()): Promise<PaidReportResponse> {
  const unique: string[] = [];
  for (const r of rawDomains) {
    const n = normalizeDomain(r);
    if (n && !unique.includes(n)) unique.push(n);
  }
  if (!unique.length) throw new Error("Add at least one valid domain.");
  if (unique.length > 10) throw new Error("Paid report covers up to ten domains.");

  const domains: PaidDomainReport[] = [];
  for (const d of unique) {
    domains.push(await paidDomainReport(d, now));
  }

  const icsEvents = [];
  for (const d of domains) {
    if (d.free.domainExpiry.date) {
      icsEvents.push({
        uid: `domain-${d.domain}@goldengoosetools.com`,
        summary: `Domain renewal: ${d.domain}`,
        isoDate: d.free.domainExpiry.date,
        description: d.registrar.renewHint,
      });
    }
    if (d.free.certExpiry.date) {
      icsEvents.push({
        uid: `cert-${d.domain}@goldengoosetools.com`,
        summary: `TLS certificate expiry: ${d.domain}`,
        isoDate: d.free.certExpiry.date,
        description: d.tls.issuer ? `Issuer: ${d.tls.issuer}` : undefined,
      });
    }
  }

  const plainSummary = domains.map((d) => d.ownerSummary).join("\n\n");

  return {
    domains,
    ics: buildIcs(icsEvents),
    plainSummary,
    paid: true,
    lookedUpAt: now.toISOString(),
  };
}
