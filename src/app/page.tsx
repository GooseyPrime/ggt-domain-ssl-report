"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { FreeLookupResult, PaidReportResponse } from "@/lib/types";
import { checkoutUrl, displayPrice } from "@/lib/shop";

const PRICE = displayPrice();

export default function Page() {
  const [domain, setDomain] = useState("example.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [free, setFree] = useState<FreeLookupResult | null>(null);
  const [multi, setMulti] = useState("");
  const [paid, setPaid] = useState<PaidReportResponse | null>(null);

  const locked = useMemo(
    () => [
      "Up to ten domains in one report",
      "Registrar / who to renew with",
      "Certificate issuer, chain, bare + www coverage",
      "Nameservers and hosting hint",
      "Mail records + spoof-risk line",
      "Redirect / HTTPS check",
      "Calendar (.ics) of renewal dates",
      "Plain summary to forward",
    ],
    []
  );

  async function onFree(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setPaid(null);
    try {
      const res = await fetch("/tools/domain-ssl-report/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setFree(data as FreeLookupResult);
    } catch (err) {
      setFree(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPaid(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const domains = multi
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const paidUrl =
        process.env.NODE_ENV === "production"
          ? "/tools/domain-ssl-report/api/report"
          : "/tools/domain-ssl-report/api/report?paid=1";
      const res = await fetch(paidUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report failed");
      setPaid(data as PaidReportResponse);
    } catch (err) {
      setPaid(null);
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadIcs() {
    if (!paid?.ics) return;
    const blob = new Blob([paid.ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domain-ssl-renewals.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="ggt-root">
      <div className="ggt-wrap">
        <header className="ggt-hero">
          <p className="ggt-eyebrow">Golden Goose Tools</p>
          <h1>Domain &amp; SSL Report</h1>
          <p className="ggt-lede">Find what is about to break — before it breaks.</p>
        </header>

        <form className="ggt-input-row" onSubmit={onFree}>
          <input
            className="ggt-input"
            type="text"
            name="domain"
            autoFocus
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            aria-label="Domain"
          />
          <button className="ggt-btn" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Check"}
          </button>
        </form>

        {error ? <p className="ggt-warn">{error}</p> : null}

        {free ? (
          <section className="ggt-result" aria-live="polite">
            <h2 className="ggt-mono">{free.domain}</h2>
            <p>
              <strong>Domain expiry:</strong>{" "}
              {free.domainExpiry.date ?? free.domainExpiry.message}
              {free.domainExpiry.daysLeft !== null
                ? ` (${free.domainExpiry.daysLeft} day(s) left)`
                : ""}
            </p>
            <p>
              <strong>Certificate expiry:</strong>{" "}
              {free.certExpiry.date ?? free.certExpiry.message}
              {free.certExpiry.daysLeft !== null
                ? ` (${free.certExpiry.daysLeft} day(s) left)`
                : ""}
            </p>
            {free.anyWarn ? (
              <p className="ggt-warn">
                Warning: at least one expiry is inside 30 days (or already past).
              </p>
            ) : null}
            <p className="ggt-muted">
              Public registry and certificate lookups only. We never invent a date the registry
              did not publish.
            </p>
          </section>
        ) : null}

        <aside className="ggt-tally ggt-tally--locked">
          <h2>Still locked</h2>
          <ul>
            {locked.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>

        <section className="ggt-paywall">
          <h2>Full report — {PRICE}</h2>
          <p className="ggt-muted">
            Up to ten domains. Checkout runs on the shop (no Stripe keys in this app). Live
            checkout stays gated until <code className="ggt-mono">domain-ssl-report</code> is on
            the shop sale allowlist.
          </p>
          <p>
            <a className="ggt-btn" href={checkoutUrl("/tools/domain-ssl-report")}>
              Unlock on shop
            </a>
          </p>

          <form className="ggt-domain-list" onSubmit={onPaid}>
            <label htmlFor="multi">
              After purchase (or local stub), paste up to ten domains:
            </label>
            <textarea
              id="multi"
              className="ggt-input"
              value={multi}
              onChange={(e) => setMulti(e.target.value)}
              placeholder={"example.com\ncloudflare.com"}
            />
            <button className="ggt-btn" type="submit" disabled={busy}>
              Build paid report (local stub)
            </button>
          </form>
        </section>

        {paid ? (
          <section className="ggt-result">
            <h2>Paid report</h2>
            <pre className="ggt-mono" style={{ whiteSpace: "pre-wrap" }}>
              {paid.plainSummary}
            </pre>
            <button className="ggt-btn" type="button" onClick={downloadIcs}>
              Download .ics
            </button>
          </section>
        ) : null}

        <p className="ggt-trust">
          Free lookups use public RDAP and a live TLS handshake. Nothing is stored. Paid once —
          no account required for the free pass.
        </p>
        <p className="ggt-muted">
          Next: SEO Audit / Fix It For Me if the site itself needs work.
        </p>
      </div>
    </main>
  );
}
