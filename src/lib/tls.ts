/** Live TLS handshake — leaf expiry, SAN, issuer, chain. No keys. */

import tls from "node:tls";
import type { CertExpiry, TlsDetails } from "./types";
import { daysUntil, shouldWarn } from "./expiry";
import { wwwOf } from "./normalize";
import { resolvePublicAddress } from "./public-ip";

function connectCert(host: string, servername: string): Promise<TlsDetails> {
  return new Promise((resolve) => {
    const socket = tls.connect(
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
          const coversBare = san.includes(servername.replace(/^www\./, "")) || san.includes(servername);
          const www = wwwOf(servername.replace(/^www\./, ""));
          const coversWww =
            san.includes(www) || san.some((s) => s.startsWith("*.") && www.endsWith(s.slice(1)));
          socket.end();
          resolve({
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
          socket.destroy();
          resolve({
            issuer: null,
            subject: null,
            notBefore: null,
            notAfter: null,
            san: [],
            coversBare: null,
            coversWww: null,
            chainSubjects: [],
            error: e instanceof Error ? e.message : "TLS parse failed",
          });
        }
      }
    );
    socket.on("error", (err) => {
      resolve({
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
      socket.destroy();
      resolve({
        issuer: null,
        subject: null,
        notBefore: null,
        notAfter: null,
        san: [],
        coversBare: null,
        coversWww: null,
        chainSubjects: [],
        error: "TLS handshake timed out.",
      });
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
  let details = await connectCert(primary.address, domain);
  if (details.error || !details.notAfter) {
    const www = wwwOf(domain);
    const altTarget = await resolvePublicAddress(www);
    if (!altTarget) return details;
    const alt = await connectCert(altTarget.address, www);
    if (!alt.error && alt.notAfter) return alt;
  }
  return details;
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
