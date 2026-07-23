import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Deal filter schema — shared by the /deals page, saved searches, and the CSV
 * export route so a saved search's JSON maps 1:1 onto URL query params.
 * Arrays serialize as comma-separated strings.
 */

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v == null || v === "") return undefined;
    if (Array.isArray(v)) return v;
    return String(v).split(",").map((s) => s.trim()).filter(Boolean);
  }, z.array(item).optional());

const numOpt = z.preprocess(
  (v) => (v == null || v === "" ? undefined : Number(v)),
  z.number().finite().optional()
);
const boolOpt = z.preprocess(
  (v) => (v === "1" || v === "true" || v === true ? true : undefined),
  z.boolean().optional()
);

export const SORTS = [
  "score-desc", "ratio-desc", "price-asc", "price-desc", "cf-desc",
  "dscr-desc", "coc-desc", "units-desc", "dom-desc", "updated-desc",
] as const;

export const filterSchema = z.object({
  q: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zip: z.string().trim().optional(),
  propertyTypes: csv(z.enum(["SINGLE_FAMILY", "DUPLEX", "TRIPLEX", "FOURPLEX", "MULTI_5_20", "MULTI_20_PLUS"])),
  colors: csv(z.enum(["DARK_GREEN", "GREEN", "YELLOW", "RED"])),
  sec8Colors: csv(z.enum(["DARK_GREEN", "GREEN", "YELLOW", "RED"])),
  status: csv(z.enum(["ACTIVE", "PENDING", "SOLD", "OFF_MARKET"])),
  rentBasis: csv(z.enum(["ACTUAL", "PRO_FORMA", "MARKET_ESTIMATE"])),
  minPrice: numOpt, maxPrice: numOpt,
  minRatioPct: numOpt, maxRatioPct: numOpt,
  minUnits: numOpt, maxUnits: numOpt,
  minYearBuilt: numOpt, maxYearBuilt: numOpt,
  minDscr: numOpt, minCf: numOpt, minScore: numOpt,
  hasPriceDrop: boolOpt,
  staleOnly: boolOpt,
  favoritesOnly: boolOpt,
  sort: z.enum(SORTS).optional().default("score-desc"),
  view: z.enum(["table", "cards", "map"]).optional().default("table"),
});

export type DealFilters = z.infer<typeof filterSchema>;

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): DealFilters {
  const flat: Record<string, string | string[] | undefined> = { ...searchParams };
  const parsed = filterSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  return filterSchema.parse({});
}

/** Serialize filters back into URL query params (for saved-search "Run" links). */
export function filtersToQuery(filters: Partial<DealFilters> & Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) p.set(k, v.join(","));
    else if (typeof v === "boolean") { if (v) p.set(k, "1"); }
    else p.set(k, String(v));
  }
  return p.toString();
}

export function buildWhere(f: DealFilters): Prisma.PropertyWhereInput {
  const where: Prisma.PropertyWhereInput = {};
  if (f.city) where.city = { equals: f.city, mode: "insensitive" };
  if (f.state) where.state = { equals: f.state, mode: "insensitive" };
  if (f.zip) where.zip = f.zip;
  if (f.propertyTypes?.length) where.propertyType = { in: f.propertyTypes };
  if (f.minUnits != null || f.maxUnits != null)
    where.unitCount = { ...(f.minUnits != null ? { gte: f.minUnits } : {}), ...(f.maxUnits != null ? { lte: f.maxUnits } : {}) };
  if (f.minYearBuilt != null || f.maxYearBuilt != null)
    where.yearBuilt = { ...(f.minYearBuilt != null ? { gte: f.minYearBuilt } : {}), ...(f.maxYearBuilt != null ? { lte: f.maxYearBuilt } : {}) };

  const metrics: Prisma.DealMetricsWhereInput = {};
  if (f.colors?.length) metrics.color = { in: f.colors };
  if (f.sec8Colors?.length) metrics.sec8Color = { in: f.sec8Colors };
  if (f.rentBasis?.length) metrics.rentBasisUsed = { in: f.rentBasis };
  if (f.minRatioPct != null || f.maxRatioPct != null)
    metrics.rentToPricePct = { ...(f.minRatioPct != null ? { gte: f.minRatioPct } : {}), ...(f.maxRatioPct != null ? { lte: f.maxRatioPct } : {}) };
  if (f.minDscr != null) metrics.dscr = { gte: f.minDscr };
  if (f.minCf != null) metrics.cashFlowMonthly = { gte: f.minCf };
  if (f.minScore != null) metrics.score = { gte: f.minScore };
  if (Object.keys(metrics).length > 0) where.metrics = { is: metrics };

  const listing: Prisma.ListingWhereInput = { isPrimary: true };
  if (f.status?.length) listing.status = { in: f.status };
  if (f.minPrice != null || f.maxPrice != null)
    listing.price = { ...(f.minPrice != null ? { gte: f.minPrice } : {}), ...(f.maxPrice != null ? { lte: f.maxPrice } : {}) };
  if (f.status?.length || f.minPrice != null || f.maxPrice != null) where.listings = { some: listing };

  if (f.favoritesOnly) where.pipeline = { is: { favorite: true } };
  return where;
}
