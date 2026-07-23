import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";
import { buildWhere, type DealFilters } from "@/lib/filters";
import { daysOnMarket } from "@/lib/format";

/** Shared deal query used by the /deals page and the CSV export route. */

export type DealRow = Awaited<ReturnType<typeof fetchDeals>>[number];

export async function fetchDeals(f: DealFilters) {
  const settings = await getAppSettings();
  const rows = await prisma.property.findMany({
    where: buildWhere(f),
    include: {
      metrics: true,
      pipeline: true,
      units: true,
      listings: {
        include: { source: true, agent: true },
        orderBy: { lastSeenAt: "desc" },
      },
    },
    take: 500,
  });

  let out = rows.map((p) => {
    const primary = p.listings.find((l) => l.isPrimary) ?? p.listings[0] ?? null;
    return { ...p, primary, dom: daysOnMarket(primary?.listDate ?? null) };
  });

  const q = f.q?.toLowerCase();
  if (q) {
    out = out.filter((p) =>
      [p.street, p.city, p.zip, p.primary?.mlsNumber, p.primary?.agent?.fullName]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }
  if (f.hasPriceDrop) {
    out = out.filter((p) => p.primary && p.primary.originalPrice != null && p.primary.price < p.primary.originalPrice);
  }
  if (f.staleOnly) {
    out = out.filter((p) => p.dom != null && p.dom >= settings.alerts.staleListingDays);
  }

  const m = (p: (typeof out)[number]) => p.metrics;
  const sorters: Record<string, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
    "score-desc": (a, b) => (m(b)?.score ?? -1) - (m(a)?.score ?? -1),
    "ratio-desc": (a, b) => (m(b)?.rentToPricePct ?? -1) - (m(a)?.rentToPricePct ?? -1),
    "price-asc": (a, b) => (a.primary?.price ?? Infinity) - (b.primary?.price ?? Infinity),
    "price-desc": (a, b) => (b.primary?.price ?? -1) - (a.primary?.price ?? -1),
    "cf-desc": (a, b) => (m(b)?.cashFlowMonthly ?? -Infinity) - (m(a)?.cashFlowMonthly ?? -Infinity),
    "dscr-desc": (a, b) => (m(b)?.dscr ?? -1) - (m(a)?.dscr ?? -1),
    "coc-desc": (a, b) => (m(b)?.cocPct ?? -Infinity) - (m(a)?.cocPct ?? -Infinity),
    "units-desc": (a, b) => b.unitCount - a.unitCount,
    "dom-desc": (a, b) => (b.dom ?? -1) - (a.dom ?? -1),
    "updated-desc": (a, b) =>
      (b.primary?.sourceUpdatedAt?.getTime() ?? 0) - (a.primary?.sourceUpdatedAt?.getTime() ?? 0),
  };
  out.sort(sorters[f.sort] ?? sorters["score-desc"]);
  return out;
}
