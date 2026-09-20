/** Live TLS handshake — leaf expiry, SAN, issuer, chain. No keys. */

import tls from "node:tls";
import type { CertExpiry, TlsDetails } from "./types";
import { daysUntil, shouldWarn } from "./expiry";
import { wwwOf } from "./normalize";
import { resolvePublicAddress } from "./public-ip";

function matchesHostname(pattern: string, hostname: string): boolean {
  const normalizedPattern = pattern.toLowerCase();
  const normalizedHost = hostname.toLowerCase();
  if (normalizedPattern === normalizedHost) return true;
  if (!normalizedPattern.startsWith("*.")) return false;
  const suffix = normalizedPattern.slice(1);
  return normalizedHost.endsWith(suffix) && normalizedHost.split(".").length === suffix.split(".").length;
}

function connectCert(host: string, servername: string): Promise<TlsDetails> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: tls.TLSSocket;
    const finish = (details: TlsDetails, destroy = false) => {
      if (settled) return;
      settled = true;
      if (destroy) socket.destroy();
      else socket.end();
      resolve(details);
    };
    socket = tls.connect(
      { host, port: 443, servername, rejectUnauthorized: false, timeout: 12000 },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          const chain: string[] = [];
          let cur: tls.DetailedPeerCertificate | tls.PeerCertificate | undefined = cert;
          const seen = new Set<string>();
          while (cur && cur.subject) {
            const sub =
              typeof cur.subject === "object" && "CN" in cur.subject
                ? String((cur.subject as { CN?: string }).CN || JSON.stringify(cur.subject))
                : String(cur.subject);
            if (seen.has(sub)) break;
            seen.add(sub);
            chain.push(sub);
            const issuerCert: tls.DetailedPeerCertificate | undefined = (
              cur as tls.DetailedPeerCertificate
            ).issuerCertificate;
            if (!issuerCert || issuerCert === cur) break;
            cur = issuerCert;
          }
          const sanRaw = (cert as tls.PeerCertificate).subjectaltname || "";
          const san = sanRaw
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.startsWith("DNS:"))
            .map((s) => s.slice(4).toLowerCase());
          const notAfter = cert.valid_to ? new Date(cert.valid_to).toISOString() : null;
          const notBefore = cert.valid_from ? new Date(cert.valid_from).toISOString() : null;
          const issuer =
            typeof cert.issuer === "object" && cert.issuer && "CN" in cert.issuer
              ? String((cert.issuer as { CN?: string }).CN || "")
              : null;
          const subject =
            typeof cert.subject === "object" && cert.subject && "CN" in cert.subject
              ? String((cert.subject as { CN?: string }).CN || "")
              : null;
          const bareHost = servername.replace(/^www\./, "");
          const coversBare = san.some((name) => matchesHostname(name, bareHost));
          const www = wwwOf(servername.replace(/^www\./, ""));
          const coversWww = san.some((name) => matchesHostname(name, www));
          finish({
            issuer: issuer || null,
            subject: subject || null,
            notBefore,
            notAfter,
            san,
            coversBare,
            coversWww,
            chainSubjects: chain,
            error: null,
          });
        } catch (e) {
            finish(
              {
                issuer: null,
                subject: null,
                notBefore: null,
                notAfter: null,
                san: [],
                coversBare: null,
                coversWww: null,
                chainSubjects: [],
                error: e instanceof Error ? e.message : "TLS parse failed",
              },
              true
            );
        }
      }
    );
    socket.on("error", (err) => {
      finish({
        issuer: null,
        subject: null,
        notBefore: null,
        notAfter: null,
        san: [],
        coversBare: null,
        coversWww: null,
        chainSubjects: [],
        error: err.message || "Could not read a certificate from this host on port 443.",
      });
    });
    socket.on("timeout", () => {
      finish(
        {
            issuer: null,
            subject: null,
            notBefore: null,
            notAfter: null,
            san: [],
            coversBare: null,
            coversWww: null,
            chainSubjects: [],
            error: "TLS handshake timed out.",
        },
        true
      );
    });
  });
}

export async function fetchTls(domain: string): Promise<TlsDetails> {
  const primary = await resolvePublicAddress(domain);
  if (!primary) {
    return {
      issuer: null,
      subject: null,
      notBefore: null,
      notAfter: null,
      san: [],
      coversBare: null,
      coversWww: null,
      chainSubjects: [],
      error: "Domain must resolve to a public IP address before TLS can be checked.",
    };
  }
  return connectCert(primary.address, domain);
}

export function certExpiryFromTls(tlsDetails: TlsDetails, now = new Date()): CertExpiry {
  if (!tlsDetails.notAfter) {
    return {
      date: null,
      message:
        tlsDetails.error ||
        "Could not read a certificate from this host on port 443.",
      daysLeft: null,
      source: "unavailable",
      warn: false,
    };
  }
  const daysLeft = daysUntil(tlsDetails.notAfter, now);
  return {
    date: tlsDetails.notAfter,
    message: null,
    daysLeft,
    source: "tls-leaf",
    warn: shouldWarn(daysLeft),
  };
}
