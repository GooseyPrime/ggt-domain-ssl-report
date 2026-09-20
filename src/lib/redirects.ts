/** HTTP(S) redirect / HTTPS-force probes. */

import http from "node:http";
import https from "node:https";
import type { RedirectMatrix, RedirectProbe } from "./types";
import { wwwOf } from "./normalize";
import { resolvePublicAddress } from "./public-ip";

async function probe(url: string): Promise<RedirectProbe> {
  try {
    const parsed = new URL(url);
    const target = await resolvePublicAddress(parsed.hostname);
    if (!target) {
      return {
        url,
        status: null,
        location: null,
        hsts: false,
        error: "Domain must resolve to a public IP address before redirects can be checked.",
      };
    }
    const isHttps = parsed.protocol === "https:";
    const request = isHttps ? https.request : http.request;
    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = request(
        {
          host: target.address,
          port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
          path: `${parsed.pathname}${parsed.search}`,
          method: "HEAD",
          headers: { Host: parsed.host },
          servername: isHttps ? parsed.hostname : undefined,
          timeout: 10000,
        },
        resolve
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("request timed out")));
      req.end();
    });
    return {
      url,
      status: res.statusCode ?? null,
      location:
        typeof res.headers.location === "string"
          ? res.headers.location
          : res.headers.location?.[0] ?? null,
      hsts: Boolean(res.headers["strict-transport-security"]),
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
