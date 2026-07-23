# DealScout — acquisitions ledger

Internal full-stack platform for **finding and underwriting high-cash-flow rental properties** (single-family through 20+ unit multifamily), built around the monthly **rent-to-price ratio** (a $70k property renting for $1,700/mo ≈ 2.43% is exceptional), transparent deal scoring, and **HUD Section 8 rent benchmarks**.

Stack: Next.js 14 (App Router, TypeScript) · PostgreSQL · Prisma · Tailwind · NextAuth (role-based) · node-cron worker · Vitest.

---

## Quickstart (local)

Requirements: Node 20+, PostgreSQL 14+.

```bash
cp .env.example .env          # fill in DATABASE_URL + NEXTAUTH_SECRET
npm install
npx prisma generate
npx prisma db push            # create schema
npm run db:seed               # demo team, Toledo market, sample listings, HUD data
npm run dev                   # http://localhost:3000
```

Optional background worker (scheduled ingestion + alerts):

```bash
npm run worker                # cron loop, default every 30 min (INGEST_CRON)
npm run ingest                # one-off ingestion run
npm test                      # 31 unit tests on the finance/scoring engines
```

### Quickstart (Docker)

```bash
docker compose up --build     # app on :3000, postgres, worker; seeds itself
```

### Demo accounts (seeded)

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `Password123!` | ADMIN — everything incl. settings & ingestion |
| `member@example.com` | `Password123!` | MEMBER — full deal work, no settings |
| `viewer@example.com` | `Password123!` | VIEWER — read-only |

The seed loads **15 sample Toledo, OH properties** through the normal ingestion pipeline (two sample sources, including one deliberate cross-source duplicate to demonstrate dedupe), FY2026 HUD FMR/SAFMR values for Toledo ZIPs, sample utility allowances, six team saved searches, and a small pipeline with notes/tasks.

> **Sample data is clearly labeled.** The bundled adapters ("Sample MLS", "Sample Feed") generate demo listings and are never presented as live market data. Photos are labeled placeholders. Connect a licensed feed to go live (below).

---

## What it does

- **Deal screen** — table / card / map views, deep filtering (city, ZIP, type, price, ratio, DSCR, units, year built, status, price-reduced, stale, favorites), 10 sort orders, CSV export of the exact filtered set, saved searches (personal + team presets), side-by-side compare (up to 5).
- **Transparent scoring** — every deal gets a 0–100 score and a **Dark green / Green / Yellow / Red** color with an itemized "score ledger": point components, pass/fail/unknown classification rules, and major flags. Defaults: Green needs 1950+, ratio ≥ 1.5%, positive cash flow, DSCR ≥ 1.25, no major flags; Dark green adds ratio ≥ 2.0%, DSCR ≥ 1.5, strong CF/unit and cap/CoC targets; pre-1950 or ratio < 1.0% or negative CF ⇒ Red; partial data ⇒ Yellow. All thresholds are editable in Settings and recompute the whole book.
- **SFRs are first-class** — single-family homes are scored by the same economics, never penalized for the asset class.
- **Rent provenance** — every rent figure is tagged **ACTUAL / PRO FORMA / MARKET ESTIMATE** and the underwriting basis is always displayed; nothing is silently substituted. Missing data shows as "Unknown", never zero, and lowers a visible confidence grade.
- **Full underwriting** — rent-to-price, gross yield, mortgage P&I, NOI, cap rate, DSCR, monthly/annual cash flow, cash-to-close, cash-on-cash, break-even occupancy, price/unit, price/sqft. A live **what-if panel** on each deal reruns the exact same engine with your offer price, rent basis, financing, and expense assumptions; scenarios can be saved.
- **Assumption scopes** — defaults (25% down, 7.5%, 30 yr, 5% vacancy, 8% mgmt, 5% maintenance, 5% capex, tax/insurance estimators) resolve **GLOBAL → MARKET → PROPERTY**.
- **Section 8 / HUD panel** — ZIP-level **SAFMR preferred**, metro FMR fallback; per-unit bedroom match; payment standard % (default 100, configurable 90–110+); utility allowance handling; estimated contract rent; uplift vs. actual rents; cash flow/DSCR at HUD rents; its own Section 8 color. Every HUD figure links to its source and carries the disclaimer that **FMR/SAFMR are benchmarks — housing-authority approved rents are not guaranteed**.
- **Agent card** — prominent contact block with call/email/copy actions, brokerage, MLS agent ID, and data freshness. Contact info is never invented; absent data says "not provided".
- **Pipeline** — 9-stage drag-and-drop kanban (New → Reviewing → Contact agent → Underwriting → Offer planned → Offer submitted → Under contract → Passed / Closed). **Passing always requires a written reason.** Favorites, tags, notes, tasks, and file attachments live on each deal.
- **Alerts** — six types with plain-language reasons: new green deal, ratio target crossed, price reduction, deal became viable, status change on pipeline deals, and stale-listing negotiation leverage. In-app inbox + optional SMTP email.
- **Change history** — price events, status changes, and pipeline moves are logged per property.
- **Dedupe** — the same address from multiple feeds merges into one property; the most authoritative (lowest priority number), freshest source wins the primary record, and all source listings stay visible on the deal page.
- **Exports** — filtered CSV from the deal screen; one-click PDF summary from any deal page.

## Architecture

```
src/
  app/                 App Router pages + API routes (REST-ish, zod-validated, role-gated)
  components/          UI (deal tape, score ledger, Sec8 panel, kanban, map, …)
  lib/
    finance/           pure underwriting engine (unit-tested, shared server+client)
    scoring/           deal color/score ledger + Section 8 analysis (unit-tested)
    hud/               FMR/SAFMR lookup (ZIP SAFMR → metro fallback)
    providers/         listing source adapters + registry (priority-based dedupe)
    ingestion/         normalize → upsert → history → metrics → alerts
    alerts/            alert rule evaluation + email
  worker/              node-cron ingestion loop
prisma/                schema + idempotent seed
docs/                  data providers, deployment, HUD data notes
```

Roles: **ADMIN** (settings, ingestion, everything), **MEMBER** (all deal work), **VIEWER** (read-only). Enforced in the UI and in every mutating API route.

## Going live with real data — credentials shopping list

The app only uses **authorized** feeds; there is no scraping. See `docs/data-providers.md` for details and links. You'll want:

1. **MLS access via a RESO Web API vendor** (pick one; requires broker sponsorship/data license):
   - MLS Grid, CoreLogic Trestle, Bridge Interactive (Zillow Group), or Spark API (FBS).
   - For Toledo: NORIS / Northwest Ohio REALTORS coverage.
   - Set `RESO_API_BASE_URL` + `RESO_API_TOKEN`, then `DEALSCOUT_DISABLE_MOCKS=1`.
2. **HUD USER API token** (free) — refresh FMR/SAFMR yearly: `HUD_API_TOKEN`.
3. **SMTP credentials** (optional) for alert email: `SMTP_URL`, `EMAIL_FROM`.
4. Optional enrichment (rent estimates, tax/assessor data): RentCast, ATTOM — adapter stubs and notes in `docs/data-providers.md`.

## Notes & guarantees

- Metrics are **estimates at stated assumptions**; estimated inputs are marked "(est.)" in every expense breakdown.
- HUD figures are benchmarks, not promised rents — the disclaimer appears wherever they do.
- The map view uses OpenStreetMap tiles and needs internet access to display.
- Attachments are stored on local disk under `public/uploads/` (swap for S3 in production).
