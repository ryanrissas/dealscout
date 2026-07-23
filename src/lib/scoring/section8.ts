import type { DealColor } from "@/generated/prisma/enums";
import { fmrForBedrooms, utilityAllowanceForBedrooms, type FmrLookupResult } from "@/lib/hud/lookup";
import { underwrite, type UnderwriteAssumptions, type UnderwriteInput } from "@/lib/finance/underwriting";
import type { Section8Thresholds } from "@/lib/scoring/thresholds";

/**
 * Section 8 opportunity analysis.
 *
 * IMPORTANT — presented with this disclaimer everywhere it appears:
 * HUD FMR, SAFMR, and a housing authority's payment standard are NOT the
 * guaranteed rent an owner will receive. Actual voucher rent depends on the
 * local payment standard, utility allowances, rent-reasonableness approval,
 * inspection, tenant income, and the specific housing authority's policies.
 */
export const SECTION8_DISCLAIMER =
  "HUD FMR/SAFMR and estimated payment standards are benchmarks, not guaranteed rents. Actual voucher rent depends on the housing authority's payment standard, utility allowances, rent-reasonableness review, inspection, and tenant income.";

export interface Sec8UnitRow {
  label: string;
  bedrooms: number;
  currentRent: number | null;
  hudBenchmark: number;          // FMR or SAFMR for this bedroom count
  paymentStandardEst: number;    // benchmark × paymentStandardPct
  utilityAllowance: number | null;
  contractRentEst: number | null; // paymentStandardEst − utility allowance (null if allowance unknown)
}

export interface Sec8Analysis {
  available: boolean;
  reasonUnavailable?: string;
  areaName?: string;
  fiscalYear?: number;
  usedSafmr?: boolean;
  effectiveDate?: string;
  sourceUrl?: string;
  dataNote?: string | null;
  paymentStandardPct?: number;
  units: Sec8UnitRow[];
  totals?: {
    hudGrossBenchmark: number;       // Σ per-unit FMR/SAFMR
    paymentStandardEst: number;
    utilityAllowance: number | null;
    contractRentEst: number | null;  // estimated owner contract rent after allowances
    currentActualRent: number | null;
    upliftMonthly: number | null;    // contract rent est − current actual
    upliftAnnual: number | null;
    upliftPct: number | null;
  };
  hudScenario?: {
    monthlyRentUsed: number;
    cashFlowMonthly: number | null;
    dscr: number | null;
    capRatePct: number | null;
    cocPct: number | null;
  };
  color: DealColor;
  reasons: string[];
  disclaimer: string;
}

export interface Sec8Input {
  units: Array<{ label: string; bedrooms: number | null; currentRent: number | null }>;
  fmrLookup: FmrLookupResult | null;
  utilityAllowances: Array<{ bedrooms: number; monthlyAmount: number }>;
  currentActualRentTotal: number | null;
  underwriteInput: Omit<UnderwriteInput, "monthlyGrossRent">;
  assumptions: UnderwriteAssumptions;
  thresholds: Section8Thresholds;
}

export function analyzeSection8(input: Sec8Input): Sec8Analysis {
  const t = input.thresholds;
  const reasons: string[] = [];

  if (!input.fmrLookup) {
    return {
      available: false,
      reasonUnavailable: "No HUD FMR/SAFMR data on file for this ZIP or metro area. Refresh HUD data or add records.",
      units: [],
      color: "YELLOW",
      reasons: ["HUD data unavailable — confirm rents with the local housing authority."],
      disclaimer: SECTION8_DISCLAIMER,
    };
  }

  const unknownBeds = input.units.filter((u) => u.bedrooms == null);
  if (input.units.length === 0 || unknownBeds.length === input.units.length) {
    return {
      available: false,
      reasonUnavailable: "Unit bedroom counts are unknown, so per-unit HUD benchmarks cannot be applied.",
      units: [],
      color: "YELLOW",
      reasons: ["Unit mix unknown — HUD benchmark requires bedrooms per unit."],
      disclaimer: SECTION8_DISCLAIMER,
    };
  }

  const rec = input.fmrLookup.record;
  const psPct = t.paymentStandardPct / 100;
  let allowanceMissing = false;

  const rows: Sec8UnitRow[] = input.units.map((u) => {
    const beds = u.bedrooms ?? 2; // rows with unknown beds are excluded above unless some are known
    const benchmark = fmrForBedrooms(rec, beds);
    const ps = Math.round(benchmark * psPct);
    const ua = utilityAllowanceForBedrooms(input.utilityAllowances, beds);
    if (ua == null) allowanceMissing = true;
    return {
      label: u.label,
      bedrooms: beds,
      currentRent: u.currentRent,
      hudBenchmark: benchmark,
      paymentStandardEst: ps,
      utilityAllowance: ua,
      contractRentEst: ua == null ? null : ps - ua,
    };
  });

  const hudGrossBenchmark = rows.reduce((s, r) => s + r.hudBenchmark, 0);
  const paymentStandardEst = rows.reduce((s, r) => s + r.paymentStandardEst, 0);
  const utilityAllowance = allowanceMissing ? null : rows.reduce((s, r) => s + (r.utilityAllowance ?? 0), 0);
  const contractRentEst = allowanceMissing ? null : rows.reduce((s, r) => s + (r.contractRentEst ?? 0), 0);

  const current = input.currentActualRentTotal;
  const upliftMonthly = current != null && contractRentEst != null ? contractRentEst - current : null;
  const upliftPct = current != null && current > 0 && contractRentEst != null ? ((contractRentEst - current) / current) * 100 : null;

  // Underwrite at the HUD-supported rent (contract-rent estimate when we have
  // allowances; otherwise the payment-standard estimate, flagged incomplete).
  const hudRentUsed = contractRentEst ?? paymentStandardEst;
  const uw = underwrite({ ...input.underwriteInput, monthlyGrossRent: hudRentUsed }, input.assumptions);
  const cfPerUnit = uw.cashFlowMonthly != null ? uw.cashFlowMonthly / Math.max(uw.unitCount, 1) : null;

  let color: DealColor;
  const incompleteData = allowanceMissing || unknownBeds.length > 0;

  if (uw.cashFlowMonthly == null || uw.dscr == null) {
    color = "YELLOW";
    reasons.push("HUD scenario could not be fully computed — confirm inputs.");
  } else if (uw.cashFlowMonthly <= 0 || uw.dscr < 1.0) {
    color = "RED";
    if (uw.cashFlowMonthly <= 0) reasons.push(`HUD-supported rent produces non-positive cash flow ($${Math.round(uw.cashFlowMonthly)}/mo).`);
    if (uw.dscr < 1.0) reasons.push(`DSCR at HUD rent is ${uw.dscr.toFixed(2)} (below 1.0) — expenses/mortgage too high relative to rent.`);
  } else if (incompleteData) {
    color = "YELLOW";
    if (allowanceMissing) reasons.push("Utility allowance schedule incomplete — confirm with the housing authority.");
    if (unknownBeds.length > 0) reasons.push(`${unknownBeds.length} unit(s) missing bedroom counts.`);
    reasons.push("Property needs confirmation from the local housing authority.");
  } else if (
    cfPerUnit != null &&
    cfPerUnit >= t.darkGreenMinCfPerUnit &&
    uw.dscr >= t.darkGreenMinDscr &&
    upliftPct != null &&
    upliftPct >= t.darkGreenUpliftPct
  ) {
    color = "DARK_GREEN";
    reasons.push(`Estimated HUD-supported rent creates exceptional cash flow ($${Math.round(cfPerUnit)}/unit/mo, DSCR ${uw.dscr.toFixed(2)}).`);
    reasons.push(`HUD benchmark is ${upliftPct.toFixed(0)}% above current rent (+$${Math.round(upliftMonthly!)}/mo).`);
  } else if (uw.dscr >= t.greenMinDscr && uw.cashFlowMonthly > 0) {
    color = "GREEN";
    reasons.push(`HUD-supported rent covers debt with margin (DSCR ${uw.dscr.toFixed(2)}, $${Math.round(uw.cashFlowMonthly)}/mo cash flow).`);
    if (upliftPct != null && upliftPct > 0) reasons.push(`Potential uplift of ${upliftPct.toFixed(0)}% over current rent, subject to housing-authority approval.`);
  } else {
    color = "YELLOW";
    reasons.push(`HUD scenario is positive but below the DSCR ${t.greenMinDscr} bar (DSCR ${uw.dscr.toFixed(2)}).`);
  }

  return {
    available: true,
    areaName: rec.areaName,
    fiscalYear: rec.fiscalYear,
    usedSafmr: input.fmrLookup.usedSafmr,
    effectiveDate: typeof rec.effectiveDate === "string" ? rec.effectiveDate : rec.effectiveDate.toISOString(),
    sourceUrl: rec.sourceUrl,
    dataNote: rec.note ?? null,
    paymentStandardPct: t.paymentStandardPct,
    units: rows,
    totals: {
      hudGrossBenchmark,
      paymentStandardEst,
      utilityAllowance,
      contractRentEst,
      currentActualRent: current,
      upliftMonthly,
      upliftAnnual: upliftMonthly != null ? upliftMonthly * 12 : null,
      upliftPct,
    },
    hudScenario: {
      monthlyRentUsed: hudRentUsed,
      cashFlowMonthly: uw.cashFlowMonthly,
      dscr: uw.dscr,
      capRatePct: uw.capRatePct,
      cocPct: uw.cocPct,
    },
    color,
    reasons,
    disclaimer: SECTION8_DISCLAIMER,
  };
}
