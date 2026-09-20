/** DNS + mail spoof assessment. Public resolvers via Node dns.promises. */

import dns from "node:dns/promises";
import type { DnsSnapshot, MailSpoofAssessment } from "./types";
import { wwwOf } from "./normalize";

async function safeResolve(fn: () => Promise<string[]>): Promise<string[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function fetchDns(domain: string): Promise<DnsSnapshot> {
  const www = wwwOf(domain);
  const [nameservers, a, aaaa, aWww, mxRecs, txt, caa] = await Promise.all([
    safeResolve(() => dns.resolveNs(domain)),
    safeResolve(() => dns.resolve4(domain)),
    safeResolve(() => dns.resolve6(domain)),
    safeResolve(() => dns.resolve4(www)),
    dns.resolveMx(domain).then((r) => r.map((m) => `${m.priority} ${m.exchange}`)).catch(() => [] as string[]),
    safeResolve(() => dns.resolveTxt(domain).then((rows) => rows.map((r) => r.join(""))),
    safeResolve(() =>
      dns.resolveCaa(domain).then((rows) =>
        rows.map((r) => `${r.critical ? "critical " : ""}${Object.entries(r).filter(([k]) => k !== "critical").map(([k, v]) => `${k}:${v}`).join(" ")}`)
      )
    ),
  ]);

  const nsJoined = nameservers.join(" ").toLowerCase();
  let hostingHint = "Hosting inferred from nameservers only — not authoritative.";
  if (nsJoined.includes("cloudflare")) hostingHint = "Inferred: Cloudflare (from nameservers).";
  else if (nsJoined.includes("awsdns") || nsJoined.includes("amazonaws"))
    hostingHint = "Inferred: Amazon Route 53 / AWS (from nameservers).";
  else if (nsJoined.includes("domaincontrol") || nsJoined.includes("godaddy"))
    hostingHint = "Inferred: GoDaddy DNS (from nameservers).";
  else if (nsJoined.includes("googledomains") || nsJoined.includes("google.com"))
    hostingHint = "Inferred: Google Domains / Cloud DNS (from nameservers).";
  else if (!nameservers.length) hostingHint = "Nameservers did not answer in time; hosting hint skipped.";

  return { nameservers, a, aaaa, aWww, mx: mxRecs, txt, caa, hostingHint };
}

export async function assessMail(domain: string, dnsSnap?: DnsSnapshot): Promise<MailSpoofAssessment> {
  const snap = dnsSnap ?? (await fetchDns(domain));
  const spf = snap.txt.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;
  let dmarc: string | null = null;
  try {
    const rows = await dns.resolveTxt(`_dmarc.${domain}`);
    dmarc = rows.map((r) => r.join("")).find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;
  } catch {
    dmarc = null;
  }

  let risk: MailSpoofAssessment["risk"] = "unknown";
  let line = "Mail authentication records were incomplete; spoof risk is unclear.";

  const spfAll = spf?.match(/([+\-~?])all\b/i)?.[1];
  const dmarcP = dmarc?.match(/\bp=([a-z]+)/i)?.[1]?.toLowerCase();

  if (!spf && !dmarc) {
    risk = "high";
    line =
      "No SPF or DMARC published — anyone on the internet can more easily send email pretending to be this domain.";
  } else if (!dmarc || dmarcP === "none") {
    risk = "elevated";
    line =
      "DMARC is missing or set to p=none — spoofed mail is unlikely to be rejected. Add or tighten DMARC.";
  } else if (spfAll === "+") {
    risk = "high";
    line = "SPF ends with +all, which effectively allows any sender. Tighten SPF.";
  } else if (dmarcP === "quarantine") {
    risk = "medium";
    line = "DMARC quarantine is better than none; reject is stronger for a small business.";
  } else if (dmarcP === "reject" && spf && spfAll !== "+") {
    risk = "low";
    line = "SPF present and DMARC p=reject — strongest common public posture against simple spoofing.";
  } else {
    risk = "medium";
    line = "Some mail authentication is present; review SPF and DMARC together with your mail host.";
  }

  return {
    spf,
    dmarc,
    mx: snap.mx,
    risk,
    line,
    dkimNote:
      "DKIM selectors are not public; this report does not invent selectors. Confirm DKIM with your mail provider.",
  };
}
