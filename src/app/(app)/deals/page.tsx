import Link from "next/link";
import { prisma } from "@/lib/db";
import { fetchDeals } from "@/lib/dealQuery";
import { parseFilters, filtersToQuery, SORTS } from "@/lib/filters";
import { typeLabel } from "@/lib/format";
import DealTable from "@/components/deals/DealTable";
import DealCards from "@/components/deals/DealCards";
import MapPanel from "@/components/deals/MapPanel";
import SaveSearchButton from "@/components/deals/SaveSearchButton";

export const dynamic = "force-dynamic";

const SORT_LABELS: Record<string, string> = {
  "score-desc": "Score (high → low)",
  "ratio-desc": "Rent-to-price ratio",
  "price-asc": "Price (low → high)",
  "price-desc": "Price (high → low)",
  "cf-desc": "Cash flow",
  "dscr-desc": "DSCR",
  "coc-desc": "Cash-on-cash",
  "units-desc": "Unit count",
  "dom-desc": "Days on market",
  "updated-desc": "Recently updated",
};

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const deals = await fetchDeals(filters);
  const savedSearches = await prisma.savedSearch.findMany({ orderBy: { createdAt: "asc" } });
  const compareIds = String(searchParams.compare ?? "").split(",").filter(Boolean);

  const qs = filtersToQuery(filters);
  const baseQuery = { ...filters };
  const viewLink = (view: "table" | "cards" | "map") => `/deals?${filtersToQuery({ ...baseQuery, view })}${compareIds.length ? `&compare=${compareIds.join(",")}` : ""}`;

  const check = (arr: string[] | undefined, v: string) => arr?.includes(v) ?? false;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Deal screen</div>
          <h1 className="mt-1 text-3xl font-semibold">Deals</h1>
        </div>
        <div className="flex items-center gap-2">
          <SaveSearchButton query={qs} />
          <a href={`/api/export/csv?${qs}`} className="btn-ghost no-underline">Export CSV</a>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Saved searches</span>
        {savedSearches.map((s) => (
          <Link
            key={s.id}
            href={`/deals?${filtersToQuery(s.filters as Record<string, unknown>)}`}
            className="rounded-sm border border-hairline bg-white px-2 py-1 text-xs no-underline hover:border-blue hover:text-blue"
          >
            {s.name}
          </Link>
        ))}
      </div>

      {compareIds.length > 0 && (
        <div className="card flex items-center justify-between px-4 py-2.5">
          <span className="text-sm">
            <span className="mono font-semibold">{compareIds.length}</span> deal{compareIds.length > 1 ? "s" : ""} selected for comparison
          </span>
          <div className="flex gap-2">
            <Link href={`/compare?ids=${compareIds.join(",")}`} className="btn-primary no-underline">Compare side by side</Link>
            <Link href={`/deals?${qs}`} className="btn-ghost no-underline">Clear</Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <form method="get" action="/deals" className="card h-fit p-4 space-y-4">
          <input type="hidden" name="view" value={filters.view} />
          <div>
            <label className="label" htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={filters.q ?? ""} className="input" placeholder="Street, city, ZIP, MLS #, agent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="city">City</label>
              <input id="city" name="city" defaultValue={filters.city ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="state">State</label>
              <input id="state" name="state" defaultValue={filters.state ?? ""} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="zip">ZIP</label>
            <input id="zip" name="zip" defaultValue={filters.zip ?? ""} className="input" />
          </div>

          <fieldset>
            <legend className="eyebrow mb-1.5">Deal color</legend>
            {(["DARK_GREEN", "GREEN", "YELLOW", "RED"] as const).map((c) => (
              <label key={c} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" name="colors" value={c} defaultChecked={check(filters.colors, c)} />
                {{ DARK_GREEN: "Dark green", GREEN: "Green", YELLOW: "Yellow", RED: "Red" }[c]}
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-1.5">Property type</legend>
            {(["SINGLE_FAMILY", "DUPLEX", "TRIPLEX", "FOURPLEX", "MULTI_5_20", "MULTI_20_PLUS"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" name="propertyTypes" value={t} defaultChecked={check(filters.propertyTypes, t)} />
                {typeLabel(t)}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="minPrice">Min price</label>
              <input id="minPrice" name="minPrice" type="number" defaultValue={filters.minPrice ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="maxPrice">Max price</label>
              <input id="maxPrice" name="maxPrice" type="number" defaultValue={filters.maxPrice ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="minRatioPct">Min ratio %</label>
              <input id="minRatioPct" name="minRatioPct" type="number" step="0.1" defaultValue={filters.minRatioPct ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="minDscr">Min DSCR</label>
              <input id="minDscr" name="minDscr" type="number" step="0.05" defaultValue={filters.minDscr ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="minUnits">Min units</label>
              <input id="minUnits" name="minUnits" type="number" defaultValue={filters.minUnits ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="maxUnits">Max units</label>
              <input id="maxUnits" name="maxUnits" type="number" defaultValue={filters.maxUnits ?? ""} className="input mono" />
            </div>
            <div>
              <label className="label" htmlFor="minYearBuilt">Built after</label>
              <input id="minYearBuilt" name="minYearBuilt" type="number" defaultValue={filters.minYearBuilt ?? ""} className="input mono" placeholder="1950" />
            </div>
            <div>
              <label className="label" htmlFor="minCf">Min CF $/mo</label>
              <input id="minCf" name="minCf" type="number" defaultValue={filters.minCf ?? ""} className="input mono" />
            </div>
          </div>

          <fieldset>
            <legend className="eyebrow mb-1.5">Listing status</legend>
            {(["ACTIVE", "PENDING", "SOLD", "OFF_MARKET"] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" name="status" value={s} defaultChecked={check(filters.status, s)} />
                {s.replace("_", " ").toLowerCase()}
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-0.5">
            <legend className="eyebrow mb-1.5">More</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hasPriceDrop" value="1" defaultChecked={!!filters.hasPriceDrop} /> Price reduced
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="staleOnly" value="1" defaultChecked={!!filters.staleOnly} /> Long days on market
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="favoritesOnly" value="1" defaultChecked={!!filters.favoritesOnly} /> Favorites only
            </label>
          </fieldset>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1 justify-center">Apply filters</button>
            <Link href="/deals" className="btn-ghost no-underline">Reset</Link>
          </div>
        </form>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-ink-faint">
              <span className="mono font-semibold text-ink">{deals.length}</span> deal{deals.length === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <form method="get" action="/deals" className="flex items-center gap-1.5">
                {Object.entries(searchParams).map(([k, v]) =>
                  k === "sort" || v == null ? null : (
                    <input key={k} type="hidden" name={k} value={Array.isArray(v) ? v.join(",") : v} />
                  )
                )}
                <label htmlFor="sort" className="eyebrow">Sort</label>
                <select id="sort" name="sort" defaultValue={filters.sort} className="input w-auto py-1">
                  {SORTS.map((s) => (
                    <option key={s} value={s}>{SORT_LABELS[s]}</option>
                  ))}
                </select>
                <button className="btn-ghost py-1">Go</button>
              </form>
              <div className="flex rounded-sm border border-hairline bg-white p-0.5">
                {(["table", "cards", "map"] as const).map((v) => (
                  <Link
                    key={v}
                    href={viewLink(v)}
                    className={`rounded-[1px] px-2.5 py-1 text-xs font-medium capitalize no-underline ${
                      filters.view === v ? "bg-ink text-paper" : "text-ink-faint hover:text-ink"
                    }`}
                  >
                    {v}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {filters.view === "table" && <DealTable deals={deals} query={qs} compareIds={compareIds} />}
          {filters.view === "cards" && <DealCards deals={deals} />}
          {filters.view === "map" && <MapPanel deals={deals} />}

          {deals.length === 0 && (
            <div className="card px-6 py-12 text-center text-sm text-ink-faint">
              No deals match these filters. Widen the criteria or run an ingestion from Settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
