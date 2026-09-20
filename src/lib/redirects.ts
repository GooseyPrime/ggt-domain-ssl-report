/** HTTP(S) redirect / HTTPS-force probes. */

import type { RedirectMatrix, RedirectProbe } from "./types";
import { wwwOf } from "./normalize";

async function probe(url: string): Promise<RedirectProbe> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    return {
      url,
      status: res.status,
      location: res.headers.get("location"),
      hsts: Boolean(res.headers.get("strict-transport-security")),
      error: null,
    };
  } catch (e) {
    return {
      url,
      status: null,
      location: null,
      hsts: false,
      error: e instanceof Error ? e.message : "request failed",
    };
  }
}

export async function fetchRedirects(domain: string): Promise<RedirectMatrix> {
  const www = wwwOf(domain);
  const probes = await Promise.all([
    probe(`http://${domain}/`),
    probe(`https://${domain}/`),
    probe(`http://${www}/`),
    probe(`https://${www}/`),
  ]);
  const httpBare = probes[0];
  const httpsBare = probes[1];
  const forcesHttps =
    Boolean(httpsBare.hsts) ||
    (httpBare.status !== null &&
      httpBare.status >= 300 &&
      httpBare.status < 400 &&
      Boolean(httpBare.location?.toLowerCase().startsWith("https://")));
  const note = forcesHttps
    ? "HTTP appears to hand off to HTTPS (redirect and/or HSTS)."
    : "HTTP did not clearly force HTTPS on this probe — confirm hosting settings.";
  return { probes, forcesHttps, note };
}
