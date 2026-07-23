import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { underwrite, type UnderwriteInput } from "@/lib/finance/underwriting";
import { selectRentBasis, type RentByKind } from "@/lib/scoring/rentBasis";
import { scoreDeal } from "@/lib/scoring/dealScore";
import { analyzeSection8 } from "@/lib/scoring/section8";
import { findFmrForZip, type FmrRecordLike } from "@/lib/hud/lookup";
import { getAppSettings, resolveAssumptions } from "@/lib/settings";
import type { AppSettings } from "@/lib/scoring/thresholds";
import type { UnderwriteAssumptions } from "@/lib/finance/underwriting";

/**
 * Deal metrics computation.
 *
 * For each property: select the rent basis (with provenance), underwrite with
 * the resolved assumptions, score/classify, run the Section 8 analysis against
 * HUD FMR/SAFMR data, and persist a DealMetrics snapshot. Missing inputs stay
 * null ("Unknown" in the UI) — they are never coerced to zero.
 */

type PropertyWithRelations = NonNullable<Awaited<ReturnType<typeof loadProperty>>>;

async function loadProperty(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      units: true,
      rentRecords: true,
      listings: { include: { source: true }, orderBy: { lastSeenAt: "desc" } },
    },
  });
}

function pickPrimaryListing(p: PropertyWithRelations) {
  const active = p.listings.filter((l) => l.status === "ACTIVE" || l.status === "PENDING");
  const pool = active.length > 0 ? active : p.listings;
  const primary = pool.find((l) => l.isPrimary) ?? pool[0];
  return primary ?? null;
}

function rentTotalsByKind(p: PropertyWithRelations): RentByKind {
  const sums: Record<string, number> = {};
  // Property-level records win outright; unit-level records of the same kind sum.
  const propertyLevel = p.rentRecords.filter((r) => !r.unitId);
  const unitLevel = p.rentRecords.filter((r) => !!r.unitId);

  for (const kind of ["ACTUAL", "PRO_FORMA", "MARKET_ESTIMATE", "HUD_BENCHMARK"] as const) {
    const prop = propertyLevel.filter((r) => r.kind === kind);
    if (prop.length > 0) {
      sums[kind] = prop.reduce((a, r) => a + r.monthlyAmount, 0);
      continue;
    }
    const units = unitLevel.filter((r) => r.kind === kind);
    if (units.length > 0) sums[kind] = units.reduce((a, r) => a + r.monthlyAmount, 0);
  }

  // Actual rent can also live directly on units (currentRent).
  if (sums.ACTUAL == null) {
    const unitRents = p.units.filter((u) => u.currentRent != null && u.currentRent > 0);
    if (unitRents.length > 0) {
      sums.ACTUAL = unitRents.reduce((a, u) => a + (u.currentRent ?? 0), 0);
    }
  }
  return sums as RentByKind;
}

export interface ComputedMetrics {
  propertyId: string;
  color: string;
  sec8Color: string | null;
  score: number;
}

export async function computeMetricsForProperty(
  propertyId: string,
  opts?: { settings?: AppSettings; assumptions?: UnderwriteAssumptions }
): Promise<ComputedMetrics | null> {
  const p = await loadProperty(propertyId);
  if (!p) return null;

  const settings = opts?.settings ?? (await getAppSettings());
  const assumptions =
    opts?.assumptions ??
    (await resolveAssumptions({ marketId: p.marketId, propertyId: p.id })).assumptions;

  const listing = pickPrimaryListing(p);
  if (!listing) return null; // nothing to underwrite without a price

  const rents = rentTotalsByKind(p);
  const basis = selectRentBasis(rents);

  const uwInput: UnderwriteInput = {
    price: listing.price,
    monthlyGrossRent: basis?.amount ?? null,
    unitCount: p.unitCount,
    buildingSqft: p.buildingSqft,
    taxesAnnualKnown: p.taxesAnnual,
    ownerUtilitiesMonthlyKnown: p.ownerUtilitiesMonthly,
    estimatedRehab: p.estimatedRehab,
  };
  const uw = underwrite(uwInput, assumptions);

  const hasUnitMix = p.units.length > 0 && p.units.every((u) => u.bedrooms != null);
  const scored = scoreDeal(
    {
      underwrite: uw,
      rentBasis: basis?.kind ?? null,
      propertyType: p.propertyType,
      yearBuilt: p.yearBuilt,
      occupancy: p.occupancy,
      codeViolations: p.codeViolations,
      floodZone: p.floodZone,
      conditionNotes: p.conditionNotes,
      hasUnitMix,
      buildingSqft: p.buildingSqft,
    },
    settings.thresholds
  );

  // ── Section 8 analysis ──────────────────────────────────────────────────────
  const fmrRows = await prisma.hudFmrRecord.findMany({
    where: { OR: [{ zip: p.zip }, { zip: null, state: p.state }] },
  });
  const fmrLookup = findFmrForZip(fmrRows as unknown as FmrRecordLike[], p.zip);

  const allowanceRows = await prisma.utilityAllowance.findMany({
    where: { state: p.state },
    orderBy: { effectiveDate: "desc" },
  });
  const allowances = allowanceRows.map((a) => ({ bedrooms: a.bedrooms, monthlyAmount: a.monthlyAmount }));

  const sec8 = analyzeSection8({
    units: p.units.map((u) => ({ label: u.label, bedrooms: u.bedrooms, currentRent: u.currentRent })),
    fmrLookup,
    utilityAllowances: allowances,
    currentActualRentTotal: rents.ACTUAL ?? null,
    underwriteInput: {
      price: listing.price,
      unitCount: p.unitCount,
      buildingSqft: p.buildingSqft,
      taxesAnnualKnown: p.taxesAnnual,
      ownerUtilitiesMonthlyKnown: p.ownerUtilitiesMonthly,
      estimatedRehab: p.estimatedRehab,
    },
    assumptions,
    thresholds: settings.section8,
  });

  const breakdown = {
    components: scored.components,
    rules: scored.rules,
    flags: scored.flags,
    classificationReason: scored.classificationReason,
    rentBasis: basis ? { kind: basis.kind, amount: basis.amount } : null,
    rentsByKind: rents,
    assumptionsUsed: assumptions,
    expenseLines: uw.expenseLines,
    taxesEstimated: uw.taxesEstimated,
    utilitiesEstimated: uw.utilitiesEstimated,
    listingId: listing.id,
    priceUsed: listing.price,
  };

  await prisma.dealMetrics.upsert({
    where: { propertyId: p.id },
    create: {
      propertyId: p.id,
      rentBasisUsed: basis?.kind ?? null,
      monthlyGrossRent: uw.monthlyGrossRent,
      rentToPricePct: uw.rentToPricePct,
      grossYieldPct: uw.grossYieldPct,
      pricePerUnit: uw.pricePerUnit,
      pricePerSqft: uw.pricePerSqft,
      noiAnnual: uw.noiAnnual,
      capRatePct: uw.capRatePct,
      dscr: uw.dscr,
      cashFlowMonthly: uw.cashFlowMonthly,
      cashFlowAnnual: uw.cashFlowAnnual,
      cashToClose: uw.cashToClose,
      cocPct: uw.cocPct,
      breakEvenOccPct: uw.breakEvenOccPct,
      score: scored.score,
      color: scored.color,
      confidence: scored.confidence,
      missingFields: scored.missingFields,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      sec8Color: sec8.available || sec8.color ? sec8.color : null,
      sec8: sec8 as unknown as Prisma.InputJsonValue,
      hudMonthlyGross: sec8.totals?.hudGrossBenchmark ?? null,
      computedAt: new Date(),
    },
    update: {
      rentBasisUsed: basis?.kind ?? null,
      monthlyGrossRent: uw.monthlyGrossRent,
      rentToPricePct: uw.rentToPricePct,
      grossYieldPct: uw.grossYieldPct,
      pricePerUnit: uw.pricePerUnit,
      pricePerSqft: uw.pricePerSqft,
      noiAnnual: uw.noiAnnual,
      capRatePct: uw.capRatePct,
      dscr: uw.dscr,
      cashFlowMonthly: uw.cashFlowMonthly,
      cashFlowAnnual: uw.cashFlowAnnual,
      cashToClose: uw.cashToClose,
      cocPct: uw.cocPct,
      breakEvenOccPct: uw.breakEvenOccPct,
      score: scored.score,
      color: scored.color,
      confidence: scored.confidence,
      missingFields: scored.missingFields,
      breakdown: breakdown as unknown as Prisma.InputJsonValue,
      sec8Color: sec8.color,
      sec8: sec8 as unknown as Prisma.InputJsonValue,
      hudMonthlyGross: sec8.totals?.hudGrossBenchmark ?? null,
      computedAt: new Date(),
    },
  });

  return { propertyId: p.id, color: scored.color, sec8Color: sec8.color, score: scored.score };
}

export async function recomputeAllMetrics(): Promise<{ count: number }> {
  const settings = await getAppSettings();
  const ids = await prisma.property.findMany({ select: { id: true, marketId: true } });
  let count = 0;
  for (const { id, marketId } of ids) {
    const { assumptions } = await resolveAssumptions({ marketId, propertyId: id });
    const res = await computeMetricsForProperty(id, { settings, assumptions });
    if (res) count++;
  }
  return { count };
}
