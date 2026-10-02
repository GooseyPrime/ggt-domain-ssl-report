/** RDAP lookups: registry found through the IANA bootstrap file, rdap.org as fallback. Never invent registry dates. */

import type { DomainExpiry, RdapDomain, RdapEntity, RegistrarInfo } from "./types";
import { daysUntil, shouldWarn } from "./expiry";

const RDAP_BASE = "https://rdap.org/domain/";

function fnFromEntity(ent: RdapEntity): string | null {
  const v = ent.vcardArray;
  if (Array.isArray(v) && Array.isArray(v[1])) {
    for (const item of v[1] as unknown[]) {
      if (Array.isArray(item) && item[0] === "fn" && typeof item[3] === "string") {
        return item[3];
      }
    }
  }
  return ent.fn ?? null;
}

function ianaIdFromEntity(ent: RdapEntity): string | null {
  const ids = ent.publicIds ?? [];
  for (const p of ids) {
    if (p.type === "IANA Registrar ID" && p.identifier) return String(p.identifier);
  }
  if (ent.handle && /^\d+$/.test(ent.handle)) return ent.handle;
  return null;
}

export function findRegistrar(entities: RdapEntity[] | undefined): RegistrarInfo {
  const list = entities ?? [];
  for (const ent of list) {
    if (ent.roles?.includes("registrar")) {
      const name = fnFromEntity(ent);
      const ianaId = ianaIdFromEntity(ent);
      const renewHint = name
        ? `Renew with ${name}${ianaId ? ` (IANA ${ianaId})` : ""}.`
        : ianaId
          ? `Renew with the registrar listed as IANA ID ${ianaId}.`
          : "Registrar name was not published in RDAP.";
      return { name, ianaId, renewHint };
    }
    if (ent.entities?.length) {
      const nested = findRegistrar(ent.entities);
      if (nested.name || nested.ianaId) return nested;
    }
  }
  return {
    name: null,
    ianaId: null,
    renewHint: "Registrar was not published in the public registry record.",
  };
}

export function parseDomainExpiry(rdap: RdapDomain | null, now = new Date()): DomainExpiry {
  if (!rdap) {
    return {
      date: null,
      message: "No public registry record found for this domain.",
      daysLeft: null,
      source: "unavailable",
      warn: false,
    };
  }
  if (rdap.errorCode || rdap.title === "Too Many Requests") {
    return {
      date: null,
      message:
        rdap.title === "Too Many Requests" || rdap.errorCode === 429
          ? "The registry rate-limited this lookup. Try again in a minute."
          : "No public registry record found for this domain.",
      daysLeft: null,
      source: "unavailable",
      warn: false,
    };
  }
  const events = rdap.events ?? [];
  const exp = events.find((e) => (e.eventAction || "").toLowerCase() === "expiration");
  if (!exp?.eventDate) {
    return {
      date: null,
      message: "This registry does not publish an expiry date.",
      daysLeft: null,
      source: "unavailable",
      warn: false,
    };
  }
  const daysLeft = daysUntil(exp.eventDate, now);
  return {
    date: exp.eventDate,
    message: null,
    daysLeft,
    source: "rdap-expiration",
    warn: shouldWarn(daysLeft),
  };
}

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const UA = "GoldenGooseTools-DomainSSLReport/1.0 (+https://www.goldengoosetools.com)";

type Bootstrap = { services?: [string[], string[]][] };
let bootstrapCache: { at: number; data: Bootstrap } | null = null;

async function loadBootstrap(): Promise<Bootstrap | null> {
  if (bootstrapCache && Date.now() - bootstrapCache.at < 6 * 3600 * 1000) return bootstrapCache.data;
  try {
    const res = await fetch(BOOTSTRAP_URL, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Bootstrap;
    bootstrapCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/** Registry RDAP base URL for a domain's TLD, or null when unknown. */
export function registryBaseFor(domain: string, bootstrap: Bootstrap | null): string | null {
  const tld = domain.toLowerCase().split(".").pop();
  if (!tld || !bootstrap?.services) return null;
  for (const [tlds, urls] of bootstrap.services) {
    if (tlds.includes(tld) && urls.length) {
      const https = urls.find((u) => u.startsWith("https://")) ?? urls[0];
      return https.endsWith("/") ? https : `${https}/`;
    }
  }
  return null;
}

async function getRdap(url: string): Promise<RdapDomain | null> {
  const res = await fetch(url, {
    headers: { Accept: "application/rdap+json, application/json", "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  if (res.status === 404) return { errorCode: 404, title: "Not Found" };
  if (res.status === 429) return { errorCode: 429, title: "Too Many Requests" };
  if (!res.ok) return null;
  return (await res.json()) as RdapDomain;
}

export async function fetchRdap(domain: string): Promise<RdapDomain | null> {
  const name = encodeURIComponent(domain);
  const base = registryBaseFor(domain, await loadBootstrap());
  if (base) {
    try {
      const direct = await getRdap(`${base}domain/${name}`);
      if (direct && direct.errorCode !== 429) return direct;
    } catch {
      /* fall through to rdap.org */
    }
  }
  try {
    return await getRdap(`${RDAP_BASE}${name}`);
  } catch {
    return null;
  }
}
