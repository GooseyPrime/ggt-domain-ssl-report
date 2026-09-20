# ggt-domain-ssl-report

Golden Goose Tools — **Domain & SSL Report** (accent Verdigris `#5f8f88`).

- **Free:** one domain → domain expiry (RDAP) + TLS certificate expiry + red warning if either is within 30 days.
- **Paid:** up to ten domains — registrar, cert chain/SAN, DNS/mail spoof line, redirects/HTTPS, `.ics`, forwardable summary.
- **Public lookups only** (no API keys). **Never invent registry dates.**
- Price from **shop config** (`NEXT_PUBLIC_GGT_PRICE`); checkout on the shop.

Product id: `domain-ssl-report` · Public path: `/tools/domain-ssl-report`

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/tools/domain-ssl-report`.

```bash
npm run typecheck
npm test
```

## Design kit

```json
"ggt-design-kit": "github:GooseyPrime/ggt-design-kit"
```

```css
@import "ggt-design-kit/src/index.css";
:root { --ggt-accent: #5f8f88; }
```

## Checkout gate

Live Stripe checkout stays **gated** until Groundwork restores the shop desk allowlist and adds `domain-ssl-report` to `SALE_PRODUCT_IDS`. Local paid report uses `?paid=1` / `ggt_paid=1` / `GGT_PAID_STUB=1` only.

No Stripe secrets in this repository.

## Fixtures

- `fixtures/rdap-with-expiration.json`
- `fixtures/rdap-no-expiration.json` (must surface "does not publish", never a guessed date)

## PR policy

Draft PRs only. Brandon merges.
