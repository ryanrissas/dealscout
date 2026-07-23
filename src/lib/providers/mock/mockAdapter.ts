import type { FetchParams, ListingProviderAdapter, NormalizedListing } from "../types";
import { FEED_DUPLICATE_LISTINGS, TOLEDO_MOCK_LISTINGS } from "./toledoData";

/**
 * Mock listing providers.
 *
 * These adapters serve a fully fictional, clearly labeled sample dataset for the
 * Toledo, OH market so the entire application can be exercised end-to-end without
 * any MLS / RESO credentials. Every listing produced here carries
 * `sourceName: "Sample MLS"` (or "Sample Feed") and fictional agents/phone numbers.
 * The UI surfaces the source name everywhere, so sample data is never presented
 * as live market data.
 *
 * Set MOCK_MUTATE=1 (env) to have the primary mock source randomly apply a small
 * price reduction to one listing per fetch. This exercises the price-event and
 * alerting pipeline exactly the way a real feed refresh would.
 */

function matchesParams(l: NormalizedListing, params: FetchParams): boolean {
  if (params.city && l.city.toLowerCase() !== params.city.toLowerCase()) {
    // Allow suburbs of the metro when the market city is Toledo.
    if (params.city.toLowerCase() === "toledo") {
      const metroCities = ["toledo", "maumee", "sylvania", "oregon", "perrysburg"];
      if (!metroCities.includes(l.city.toLowerCase())) return false;
    } else {
      return false;
    }
  }
  if (params.state && l.state.toLowerCase() !== params.state.toLowerCase()) return false;
  if (params.zips && params.zips.length > 0 && !params.zips.includes(l.zip)) return false;
  return true;
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Primary mock source — plays the role of the authorized MLS feed. */
export const mockMlsAdapter: ListingProviderAdapter = {
  key: "MOCK_MLS",
  name: "Sample MLS",
  kind: "mock",
  priority: 20,
  isConfigured: () => true,
  async fetchListings(params: FetchParams): Promise<NormalizedListing[]> {
    let listings = TOLEDO_MOCK_LISTINGS.filter((l) => matchesParams(l, params)).map(deepClone);

    if (process.env.MOCK_MUTATE === "1" && listings.length > 0) {
      // Deterministically-random small price drop on an ACTIVE listing to
      // demonstrate price events + alerts on repeat ingestion runs.
      const active = listings.filter((l) => l.status === "ACTIVE" && l.price > 60000);
      if (active.length > 0) {
        const pick = active[Math.floor(Math.random() * active.length)];
        const dropPct = 0.03 + Math.random() * 0.03; // 3–6%
        const newPrice = Math.round((pick.price * (1 - dropPct)) / 100) * 100;
        pick.price = newPrice;
        pick.sourceUpdatedAt = new Date().toISOString();
      }
    }
    return listings;
  },
};

/**
 * Secondary mock source — a lower-priority "aggregator feed" that carries a
 * duplicate of one Sample MLS listing (slightly stale). Exists to demonstrate
 * cross-source deduplication: the property record is shared, both listings are
 * preserved and linked, and the fresher/higher-priority source stays primary.
 */
export const mockFeedAdapter: ListingProviderAdapter = {
  key: "MOCK_FEED",
  name: "Sample Feed",
  kind: "mock",
  priority: 30,
  isConfigured: () => true,
  async fetchListings(params: FetchParams): Promise<NormalizedListing[]> {
    return FEED_DUPLICATE_LISTINGS.filter((l) => matchesParams(l, params)).map(deepClone);
  },
};
