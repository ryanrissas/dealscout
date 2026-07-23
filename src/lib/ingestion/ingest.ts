import { prisma } from "@/lib/db";
import { activeAdapters } from "@/lib/providers/registry";
import type { FetchParams, NormalizedListing, ListingProviderAdapter } from "@/lib/providers/types";
import { computeMetricsForProperty } from "@/lib/metrics";
import { evaluateAlertsForChanges, type PropertyChangeFacts } from "@/lib/alerts/engine";
import type { DealColor } from "@/generated/prisma/enums";

/**
 * Ingestion pipeline.
 *
 * fetch (all configured sources) → normalize → dedupe by address key →
 * upsert property/units/agent/listing → record price & status history →
 * recompute deal metrics → diff against previous state → fire alerts.
 *
 * Dedupe: properties key on normalized "street|zip". When multiple sources
 * carry the same property, each keeps its own Listing row (links preserved),
 * and the primary listing is the one from the most authoritative source
 * (lowest adapter priority), tie-broken by the provider's own freshness
 * timestamp. Facts on the shared Property record are only overwritten by the
 * primary source, or fill in blanks from secondary sources.
 */

export function normalizeAddressKey(street: string, zip: string): string {
  const s = street
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(boulevard)\b/g, "blvd")
    .replace(/\b(parkway)\b/g, "pkwy")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(lane)\b/g, "ln")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(place)\b/g, "pl")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\s+/g, " ")
    .trim();
  return `${s}|${zip.trim()}`;
}

async function ensureSource(adapter: ListingProviderAdapter) {
  return prisma.listingSource.upsert({
    where: { key: adapter.key },
    create: {
      key: adapter.key,
      name: adapter.name,
      kind: adapter.kind,
      priority: adapter.priority,
      website: adapter.website ?? null,
    },
    update: { name: adapter.name, kind: adapter.kind, priority: adapter.priority },
  });
}

async function upsertAgent(n: NormalizedListing, sourceKey: string) {
  if (!n.agent) return null;
  const a = n.agent;
  return prisma.agent.upsert({
    where: { fullName_brokerage: { fullName: a.fullName, brokerage: a.brokerage } },
    create: {
      fullName: a.fullName,
      brokerage: a.brokerage,
      phone: a.phone ?? null,
      email: a.email ?? null,
      officePhone: a.officePhone ?? null,
      mlsAgentId: a.mlsAgentId ?? null,
      sourceKey,
      sourceUpdatedAt: n.sourceUpdatedAt ? new Date(n.sourceUpdatedAt) : new Date(),
    },
    update: {
      phone: a.phone ?? undefined,
      email: a.email ?? undefined,
      officePhone: a.officePhone ?? undefined,
      mlsAgentId: a.mlsAgentId ?? undefined,
      sourceKey,
      sourceUpdatedAt: n.sourceUpdatedAt ? new Date(n.sourceUpdatedAt) : new Date(),
    },
  });
}

interface IngestOptions extends FetchParams {
  marketId?: string | null;
}

export interface IngestRunResult {
  fetched: number;
  propertiesTouched: number;
  newProperties: number;
  priceEvents: number;
  alertsCreated: number;
  errors: Array<{ source: string; message: string }>;
}

export async function runIngestion(opts: IngestOptions = {}): Promise<IngestRunResult> {
  const result: IngestRunResult = {
    fetched: 0,
    propertiesTouched: 0,
    newProperties: 0,
    priceEvents: 0,
    alertsCreated: 0,
    errors: [],
  };

  // ── Snapshot pre-ingestion state for alert diffing ─────────────────────────
  const prevMetrics = await prisma.dealMetrics.findMany({
    select: { propertyId: true, color: true, rentToPricePct: true },
  });
  const prevByProp = new Map(prevMetrics.map((m) => [m.propertyId, m]));
  const prevListings = await prisma.listing.findMany({
    where: { isPrimary: true },
    select: { propertyId: true, price: true, status: true },
  });
  const prevListingByProp = new Map(prevListings.map((l) => [l.propertyId, l]));

  const touched = new Set<string>();
  const newProps = new Set<string>();

  // ── Fetch + upsert per source (authoritative sources first) ────────────────
  const adapters = activeAdapters();
  for (const adapter of adapters) {
    let listings: NormalizedListing[] = [];
    try {
      listings = await adapter.fetchListings(opts);
    } catch (err) {
      result.errors.push({ source: adapter.key, message: (err as Error).message });
      continue;
    }
    result.fetched += listings.length;
    const source = await ensureSource(adapter);

    for (const n of listings) {
      const addressKey = normalizeAddressKey(n.street, n.zip);
      const existing = await prisma.property.findUnique({
        where: { addressKey },
        include: { listings: { include: { source: true } } },
      });

      // Property upsert. A source only overwrites facts when it's at least as
      // authoritative as the current primary source; otherwise it fills blanks.
      const currentPrimary = existing?.listings.find((l) => l.isPrimary);
      const canOverwrite =
        !existing || !currentPrimary || adapter.priority <= currentPrimary.source.priority;

      const factData = {
        street: n.street,
        city: n.city,
        state: n.state,
        zip: n.zip,
        county: n.county ?? undefined,
        latitude: n.latitude ?? undefined,
        longitude: n.longitude ?? undefined,
        propertyType: n.propertyType,
        unitCount: n.unitCount,
        yearBuilt: n.yearBuilt ?? undefined,
        buildingSqft: n.buildingSqft ?? undefined,
        lotSqft: n.lotSqft ?? undefined,
        description: n.description ?? undefined,
        photos: n.photos ?? undefined,
        occupancy: n.occupancy ?? undefined,
        taxesAnnual: n.taxesAnnual ?? undefined,
        taxAssessedValue: n.taxAssessedValue ?? undefined,
        ownerPaidUtilities: n.ownerPaidUtilities ?? undefined,
        ownerUtilitiesMonthly: n.ownerUtilitiesMonthly ?? undefined,
        parking: n.parking ?? undefined,
        heating: n.heating ?? undefined,
        cooling: n.cooling ?? undefined,
        roof: n.roof ?? undefined,
        foundation: n.foundation ?? undefined,
        floodZone: n.floodZone ?? undefined,
        codeViolations: n.codeViolations ?? undefined,
        conditionNotes: n.conditionNotes ?? undefined,
        estimatedRehab: n.estimatedRehab ?? undefined,
        marketId: opts.marketId ?? undefined,
      };

      let property;
      if (!existing) {
        property = await prisma.property.create({
          data: { addressKey, ...factData },
        });
        newProps.add(property.id);
      } else if (canOverwrite) {
        property = await prisma.property.update({ where: { id: existing.id }, data: factData });
      } else {
        // Fill blanks only.
        const fillData: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(factData)) {
          if (v === undefined) continue;
          const cur = (existing as Record<string, unknown>)[k];
          if (cur == null || (Array.isArray(cur) && cur.length === 0)) fillData[k] = v;
        }
        property =
          Object.keys(fillData).length > 0
            ? await prisma.property.update({ where: { id: existing.id }, data: fillData })
            : existing;
      }
      touched.add(property.id);

      // Units: replace wholesale when this source is authoritative and provides a mix.
      if (n.units && n.units.length > 0 && canOverwrite) {
        await prisma.unit.deleteMany({ where: { propertyId: property.id } });
        await prisma.unit.createMany({
          data: n.units.map((u) => ({
            propertyId: property.id,
            label: u.label,
            bedrooms: u.bedrooms ?? 0,
            bathrooms: u.bathrooms ?? 1,
            sqft: u.sqft ?? null,
            currentRent: u.currentRent ?? null,
            occupied: u.occupied ?? null,
          })),
        });
      }

      // Rent records by provenance — replace this source's contributions.
      if (n.rents && canOverwrite) {
        await prisma.rentRecord.deleteMany({
          where: { propertyId: property.id, source: adapter.name },
        });
        const rows: Array<{ kind: "ACTUAL" | "PRO_FORMA" | "MARKET_ESTIMATE"; amt: number | null | undefined }> = [
          { kind: "ACTUAL", amt: n.rents.actualMonthlyTotal },
          { kind: "PRO_FORMA", amt: n.rents.proFormaMonthlyTotal },
          { kind: "MARKET_ESTIMATE", amt: n.rents.marketEstimateMonthlyTotal },
        ];
        for (const r of rows) {
          if (r.amt != null && r.amt > 0) {
            await prisma.rentRecord.create({
              data: {
                propertyId: property.id,
                kind: r.kind,
                monthlyAmount: r.amt,
                source: adapter.name,
                note: n.rents.note ?? null,
                effectiveDate: n.sourceUpdatedAt ? new Date(n.sourceUpdatedAt) : new Date(),
              },
            });
          }
        }
      }

      // Agent + listing upsert.
      const agent = await upsertAgent(n, adapter.key);
      const priorListing = await prisma.listing.findUnique({
        where: { sourceId_mlsNumber: { sourceId: source.id, mlsNumber: n.mlsNumber } },
      });

      const listingData = {
        propertyId: property.id,
        sourceId: source.id,
        agentId: agent?.id ?? null,
        mlsNumber: n.mlsNumber,
        url: n.url ?? null,
        status: n.status,
        price: n.price,
        originalPrice: n.originalPrice ?? priorListing?.originalPrice ?? n.price,
        listDate: n.listDate ? new Date(n.listDate) : priorListing?.listDate ?? null,
        lastSeenAt: new Date(),
        sourceUpdatedAt: n.sourceUpdatedAt ? new Date(n.sourceUpdatedAt) : new Date(),
        raw: (n.raw ?? undefined) as object | undefined,
      };

      let listing;
      if (!priorListing) {
        listing = await prisma.listing.create({
          data: { ...listingData, statusChangedAt: new Date() },
        });
        await prisma.listingPriceEvent.create({
          data: { listingId: listing.id, price: n.price },
        });
      } else {
        // Price change → event + history.
        if (priorListing.price !== n.price) {
          await prisma.listingPriceEvent.create({
            data: { listingId: priorListing.id, price: n.price },
          });
          await prisma.propertyStatusHistory.create({
            data: {
              propertyId: property.id,
              field: "listing.price",
              oldValue: String(priorListing.price),
              newValue: String(n.price),
            },
          });
          result.priceEvents++;
        }
        // Status change → history.
        const statusChanged = priorListing.status !== n.status;
        if (statusChanged) {
          await prisma.propertyStatusHistory.create({
            data: {
              propertyId: property.id,
              field: "listing.status",
              oldValue: priorListing.status,
              newValue: n.status,
            },
          });
        }
        listing = await prisma.listing.update({
          where: { id: priorListing.id },
          data: {
            ...listingData,
            statusChangedAt: statusChanged ? new Date() : priorListing.statusChangedAt,
          },
        });
      }

      // Re-elect the primary listing among all sources for this property:
      // lowest source priority wins; ties go to the freshest sourceUpdatedAt.
      const siblings = await prisma.listing.findMany({
        where: { propertyId: property.id },
        include: { source: true },
      });
      const ranked = [...siblings].sort((a, b) => {
        if (a.source.priority !== b.source.priority) return a.source.priority - b.source.priority;
        const at = a.sourceUpdatedAt?.getTime() ?? 0;
        const bt = b.sourceUpdatedAt?.getTime() ?? 0;
        return bt - at;
      });
      const primaryId = ranked[0]?.id;
      for (const s of siblings) {
        const shouldBePrimary = s.id === primaryId;
        if (s.isPrimary !== shouldBePrimary) {
          await prisma.listing.update({ where: { id: s.id }, data: { isPrimary: shouldBePrimary } });
        }
      }
      void listing;
    }
  }

  // ── Recompute metrics + build alert facts ──────────────────────────────────
  const changes: PropertyChangeFacts[] = [];
  for (const propertyId of touched) {
    const computed = await computeMetricsForProperty(propertyId);
    if (!computed) continue;
    const metrics = await prisma.dealMetrics.findUnique({ where: { propertyId } });
    const prop = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { listings: { where: { isPrimary: true }, take: 1 } },
    });
    if (!prop || !metrics) continue;
    const primary = prop.listings[0] ?? null;
    const prev = prevByProp.get(propertyId);
    const prevL = prevListingByProp.get(propertyId);
    const dom =
      primary?.listDate != null
        ? Math.floor((Date.now() - primary.listDate.getTime()) / 86_400_000)
        : null;

    changes.push({
      propertyId,
      address: `${prop.street}, ${prop.city}`,
      isNewProperty: newProps.has(propertyId),
      prevColor: (prev?.color as DealColor | undefined) ?? null,
      newColor: metrics.color,
      prevRatioPct: prev?.rentToPricePct ?? null,
      newRatioPct: metrics.rentToPricePct,
      prevPrice: prevL?.price ?? null,
      newPrice: primary?.price ?? null,
      prevStatus: prevL?.status ?? null,
      newStatus: primary?.status ?? null,
      daysOnMarket: dom,
      cashFlowMonthly: metrics.cashFlowMonthly,
      dscr: metrics.dscr,
    });
  }

  result.propertiesTouched = touched.size;
  result.newProperties = newProps.size;
  result.alertsCreated = await evaluateAlertsForChanges(changes);
  return result;
}
