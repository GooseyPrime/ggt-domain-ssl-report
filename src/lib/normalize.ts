/**
 * Normalize messy buyer input into a bare domain hostname.
 * Handles scheme, path, port, spaces, uppercase, trailing dots.
 */
export function normalizeDomain(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  // Strip surrounding punctuation buyers sometimes paste
  s = s.replace(/^["'`<\(\[]+|["'`>\)\]]+$/g, "");

  // If it looks like a URL without scheme, prepend http:// for URL parse
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) && s.includes("/")) {
    s = `http://${s}`;
  } else if (/^https?:\/\//i.test(s) || /^\/\//.test(s)) {
    if (s.startsWith("//")) s = `http:${s}`;
  }

  let host: string;
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      host = u.hostname;
    } else {
      // strip path/query if pasted without scheme: example.com/foo
      host = s.split(/[/?#]/)[0] ?? "";
      // strip credentials
      if (host.includes("@")) host = host.split("@").pop() ?? "";
      // strip port
      if (host.includes(":") && !host.includes("]")) {
        host = host.split(":")[0] ?? "";
      }
    }
  } catch {
    return null;
  }

  host = host.trim().toLowerCase();
  // strip trailing dots (FQDN form)
  host = host.replace(/\.+$/, "");
  // strip leading www. is NOT done — buyer may want www; we check bare separately for TLS
  // but free path uses the domain as entered after normalize — strip www for registry?
  // Product: one domain input. Use apex for RDAP. If user pastes www., strip for lookup.
  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  // Basic hostname validation (ASCII / punycode labels)
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(host)) {
    // allow single-label for tests? No — need a TLD
    return null;
  }

  if (host.length > 253) return null;
  return host;
}

export function wwwOf(domain: string): string {
  return domain.startsWith("www.") ? domain : `www.${domain}`;
}
