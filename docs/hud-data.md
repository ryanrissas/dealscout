# HUD data model & Section 8 math

## Sources

- **FMR / SAFMR** (`HudFmrRecord`): fiscal-year rents by bedroom count.
  ZIP-level SAFMR rows (`zip` set) are preferred; metro rows (`metroCode`)
  are the fallback. Each row stores its `sourceUrl` and `effectiveDate`,
  which the UI displays.
- **Utility allowances** (`UtilityAllowance`): monthly allowances by bedroom
  count from the local housing authority schedule. Seeded values are SAMPLE
  data and the UI flags them (`dataNote`).

## Per-property analysis (`src/lib/scoring/section8.ts`)

For each unit with a known bedroom count:

```
benchmark          = SAFMR(zip, br) || FMR(metro, br)
payment standard   = benchmark × paymentStandardPct (default 100%, configurable)
est. contract rent = payment standard − utility allowance(br)   (gross-rent test)
```

Totals roll up across units; uplift compares estimated contract rent to the
property's ACTUAL rents (only when actuals exist). A full underwriting pass
re-runs at the HUD-based rent to produce cash flow, DSCR, cap and CoC "at HUD
rents", and the Section 8 color:

- **Dark green**: CF/unit ≥ $150/mo, DSCR ≥ 1.5, uplift ≥ 15% (thresholds editable)
- **Green**: positive CF and DSCR ≥ 1.25 at HUD rents
- **Yellow**: missing bedrooms/allowances or thin margins
- **Red**: negative CF or DSCR < 1.0 at HUD rents

## Disclaimer (shown wherever HUD numbers appear)

FMR/SAFMR are **benchmarks**. Actual approved rents are determined by the
housing authority via rent-reasonableness and the tenant's gross-rent test,
and are **not guaranteed**. Payment standards vary 90–110% of FMR (sometimes
beyond with waivers); utility allowance schedules change. Verify with the
local PHA (for Toledo: Lucas Metropolitan Housing) before underwriting to
these numbers.

## Refreshing data

With `HUD_API_TOKEN` set, fetch new fiscal-year values from the HUD USER API
(https://www.huduser.gov/portal/dataset/fmr-api.html) and upsert
`HudFmrRecord` rows; the seed shows the expected shape. Utility allowances
must be transcribed from the PHA's published schedule.
