# Data providers — what to sign up for

DealScout only ingests **authorized** data. Every source is an adapter in
`src/lib/providers/`; the registry dedupes across sources by priority
(lower number = more authoritative).

## 1. MLS listings (required for live data)

You need MLS membership or a broker data license, then API access through one
of the major RESO Web API distributors. Any of these plugs into the bundled
`RESO_WEB_API` adapter (`src/lib/providers/reso/`):

| Vendor | Notes | Link |
|---|---|---|
| **MLS Grid** | Standardized RESO Web API across many MLSs; per-MLS licensing | https://www.mlsgrid.com |
| **CoreLogic Trestle** | Large national coverage, RESO certified | https://trestle.corelogic.com |
| **Bridge Interactive** (Zillow Group) | RESO Web API; agreements via each MLS | https://www.bridgeinteractive.com |
| **Spark API** (FBS / flexmls) | RESO-compatible API for flexmls MLSs | https://www.sparkplatform.com |

For the default **Toledo, OH** market, listings are covered by **NORIS**
(Northwest Ohio Regional Information System) / Northwest Ohio REALTORS —
ask them which distributor (Trestle/MLS Grid/etc.) carries their feed and
request IDX or VOW + data-license access.

Configure:

```
RESO_API_BASE_URL="https://api.example-distributor.com/reso/odata"
RESO_API_TOKEN="…"
DEALSCOUT_DISABLE_MOCKS=1   # remove the sample adapters once live
```

The adapter reads standard RESO `Property` resources (ListPrice, StandardStatus,
UnparsedAddress, ListAgent*, etc.). Field quirks vary by MLS; adjust the
mapping in `src/lib/providers/reso/resoAdapter.ts`.

## 2. HUD Fair Market Rents (free)

- Sign up: https://www.huduser.gov/portal/dataset/fmr-api.html → `HUD_API_TOKEN`.
- ZIP-level **SAFMR** is preferred; the metro-wide FMR is the fallback
  (`src/lib/hud/`). FY2026 Toledo metro + ZIP values ship in the seed.
- **Utility allowances are set by each housing authority** (for Toledo: Lucas
  Metropolitan Housing). There is no national API; download their current
  allowance schedule and load it into the `UtilityAllowance` table. The seeded
  allowances are SAMPLE values and are flagged as such in the UI.

## 3. Optional enrichment

| Provider | Use | Link |
|---|---|---|
| **RentCast** | Rent estimates (MARKET_ESTIMATE provenance) | https://www.rentcast.io/api |
| **ATTOM** | Assessor/tax records, sales history | https://api.developer.attomdata.com |

Add adapters under `src/lib/providers/` implementing `ListingProviderAdapter`
(or write enrichment jobs that create `RentRecord` rows with the correct
`kind` — provenance must always be truthful).

## 4. Email (optional)

Any SMTP service works: `SMTP_URL="smtp://user:pass@host:587"`, `EMAIL_FROM`.
Without SMTP, alert emails print to the server console.
