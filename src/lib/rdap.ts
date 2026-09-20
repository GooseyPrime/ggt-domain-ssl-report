/** RDAP lookups via rdap.org. Never invent registry dates. */

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

export async function fetchRdap(domain: string): Promise<RdapDomain | null> {
  const url = `${RDAP_BASE}${encodeURIComponent(domain)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json, application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return { errorCode: 404, title: "Not Found" };
    if (res.status === 429) return { errorCode: 429, title: "Too Many Requests" };
    if (!res.ok) return { errorCode: res.status, title: `HTTP ${res.status}` };
    return (await res.json()) as RdapDomain;
  } catch {
    return null;
  }
}
