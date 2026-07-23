import type { DealColor, Confidence, PropertyType, RentKind, OccupancyStatus } from "@/generated/prisma/enums";
import type { UnderwriteResult } from "@/lib/finance/underwriting";
import type { ScoringThresholds } from "@/lib/scoring/thresholds";

/**
 * Transparent deal scoring.
 *
 * Two independent outputs, both shown to the user:
 *  1. A 0–100 score assembled as a points ledger (each component lists points
 *     earned, the maximum, and why).
 *  2. A rule-based color classification (DARK_GREEN / GREEN / YELLOW / RED)
 *     that follows the configured thresholds exactly, with every rule's
 *     pass/fail/unknown status recorded.
 *
 * Missing data is never treated as zero: unknowns are labeled "Unknown",
 * reduce confidence, and generally route to YELLOW rather than RED.
 */

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export type RuleStatus = "pass" | "fail" | "unknown";

export interface ClassificationRule {
  key: string;
  label: string;
  status: RuleStatus;
  detail: string;
}

export interface DealScoreInput {
  underwrite: UnderwriteResult;
  rentBasis: RentKind | null;
  propertyType: PropertyType;
  yearBuilt: number | null;
  occupancy: OccupancyStatus;
  codeViolations: string | null;
  floodZone: string | null;
  conditionNotes: string | null;
  hasUnitMix: boolean;
  buildingSqft: number | null;
}

export interface DealScoreResult {
  score: number;
  color: DealColor;
  confidence: Confidence;
  missingFields: string[];
  components: ScoreComponent[];
  rules: ClassificationRule[];
  flags: string[];
  classificationReason: string;
}

/** Piecewise-linear interpolation over sorted [x, points] anchors. */
function scale(value: number, anchors: Array<[number, number]>): number {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (value <= anchors[i][0]) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return anchors[anchors.length - 1][1];
}

export function majorFlags(input: Pick<DealScoreInput, "codeViolations" | "floodZone" | "conditionNotes">): string[] {
  const flags: string[] = [];
  if (input.codeViolations && input.codeViolations.trim()) flags.push(`Code violations on record: ${input.codeViolations}`);
  if (input.floodZone && /^(A|V)/i.test(input.floodZone.trim())) flags.push(`High-risk flood zone: ${input.floodZone}`);
  if (input.conditionNotes && /(condemn|fire damage|structural|foundation failure|unsafe)/i.test(input.conditionNotes)) {
    flags.push(`Condition concern: ${input.conditionNotes}`);
  }
  return flags;
}

export function scoreDeal(input: DealScoreInput, t: ScoringThresholds): DealScoreResult {
  const u = input.underwrite;
  const components: ScoreComponent[] = [];
  const rules: ClassificationRule[] = [];
  const missing: string[] = [];
  const flags = majorFlags(input);

  const fmtPct = (v: number | null) => (v == null ? "Unknown" : `${v.toFixed(2)}%`);
  const fmt$ = (v: number | null) => (v == null ? "Unknown" : `$${Math.round(v).toLocaleString()}`);

  // ── Missing-data inventory ──
  if (u.monthlyGrossRent == null) missing.push("Rent (no actual, market-estimate, or pro forma rent on file)");
  if (input.yearBuilt == null) missing.push("Year built");
  if (u.taxesEstimated) missing.push("Property taxes (estimated from price)");
  if (u.utilitiesEstimated) missing.push("Owner-paid utilities (assumed $0 — verify)");
  if (input.buildingSqft == null) missing.push("Building square footage");
  if (!input.hasUnitMix) missing.push("Unit mix (bedrooms/baths by unit)");
  if (input.occupancy === "UNKNOWN") missing.push("Occupancy");

  // ── Score ledger (max 100) ──
  const ratio = u.rentToPricePct;
  components.push({
    key: "ratio",
    label: "Rent-to-price ratio",
    max: 35,
    points: ratio == null ? 0 : Math.round(scale(ratio, [[0.5, 0], [1.0, 10], [1.5, 22], [2.0, 30], [2.5, 35]])),
    detail: ratio == null ? "Unknown — no usable rent" : `${ratio.toFixed(2)}% monthly rent ÷ price`,
  });

  const cfPerUnit = u.cashFlowMonthly != null ? u.cashFlowMonthly / Math.max(u.unitCount, 1) : null;
  components.push({
    key: "cashflow",
    label: "Cash flow per unit",
    max: 15,
    points: cfPerUnit == null ? 0 : Math.round(scale(cfPerUnit, [[0, 0], [200, 15]])),
    detail: cfPerUnit == null ? "Unknown" : `${fmt$(u.cashFlowMonthly)}/mo total → ${fmt$(cfPerUnit)}/unit`,
  });

  components.push({
    key: "dscr",
    label: "Debt service coverage",
    max: 15,
    points: u.dscr == null ? 0 : Math.round(scale(u.dscr, [[1.0, 0], [1.5, 15]])),
    detail: u.dscr == null ? "Unknown" : `DSCR ${u.dscr.toFixed(2)}`,
  });

  components.push({
    key: "coc",
    label: "Cash-on-cash return",
    max: 10,
    points: u.cocPct == null ? 0 : Math.round(scale(u.cocPct, [[0, 0], [t.targetCocPct, 7], [15, 10]])),
    detail: u.cocPct == null ? "Unknown" : `${u.cocPct.toFixed(1)}% vs ${t.targetCocPct}% target`,
  });

  components.push({
    key: "cap",
    label: "Cap rate",
    max: 10,
    points: u.capRatePct == null ? 0 : Math.round(scale(u.capRatePct, [[4, 0], [t.targetCapRatePct, 7], [10, 10]])),
    detail: u.capRatePct == null ? "Unknown" : `${u.capRatePct.toFixed(2)}% vs ${t.targetCapRatePct}% target`,
  });

  components.push({
    key: "age",
    label: `Year built vs ${t.minYearBuilt} minimum`,
    max: 5,
    points: input.yearBuilt == null ? 2 : input.yearBuilt >= t.minYearBuilt ? 5 : 0,
    detail: input.yearBuilt == null ? "Unknown year built" : `Built ${input.yearBuilt}`,
  });

  // Data confidence component
  let confidence: Confidence;
  if (u.monthlyGrossRent == null) confidence = "LOW";
  else if (input.rentBasis === "ACTUAL") confidence = "HIGH";
  else if (input.rentBasis === "MARKET_ESTIMATE") confidence = "MEDIUM";
  else confidence = "LOW"; // PRO_FORMA or other
  if (confidence === "HIGH" && (u.taxesEstimated || input.yearBuilt == null)) confidence = "MEDIUM";
  if (confidence === "MEDIUM" && missing.length >= 4) confidence = "LOW";

  components.push({
    key: "confidence",
    label: "Data confidence",
    max: 10,
    points: confidence === "HIGH" ? 10 : confidence === "MEDIUM" ? 6 : 2,
    detail:
      missing.length === 0
        ? `All key fields on file · rent basis: ${input.rentBasis ?? "none"}`
        : `${missing.length} missing/estimated field${missing.length === 1 ? "" : "s"} · rent basis: ${input.rentBasis ?? "none"}`,
  });

  let score = components.reduce((s, c) => s + c.points, 0);
  if (flags.length) {
    components.push({
      key: "flags",
      label: "Risk flag deduction",
      max: 0,
      points: -15 * flags.length,
      detail: flags.join(" · "),
    });
    score += -15 * flags.length;
  }
  score = Math.max(0, Math.min(100, score));

  // ── Classification rules ──
  const addRule = (key: string, label: string, status: RuleStatus, detail: string) =>
    rules.push({ key, label, status, detail });

  const typeAllowed = t.allowedPropertyTypes.includes(input.propertyType);
  addRule(
    "type",
    "Property type meets selected criteria",
    typeAllowed ? "pass" : "fail",
    typeAllowed ? input.propertyType.replaceAll("_", " ") : `${input.propertyType} is excluded by current settings`
  );

  const yearStatus: RuleStatus = input.yearBuilt == null ? "unknown" : input.yearBuilt >= t.minYearBuilt ? "pass" : "fail";
  addRule(
    "year",
    `Built ${t.minYearBuilt} or newer`,
    yearStatus,
    input.yearBuilt == null ? "Year built unknown" : `Built ${input.yearBuilt}`
  );

  const ratioStatus: RuleStatus = ratio == null ? "unknown" : ratio >= t.greenRatioPct ? "pass" : "fail";
  addRule("ratio_green", `Rent-to-price ≥ ${t.greenRatioPct}%`, ratioStatus, fmtPct(ratio));
  addRule(
    "ratio_dark",
    `Rent-to-price ≥ ${t.darkGreenRatioPct}% (exceptional)`,
    ratio == null ? "unknown" : ratio >= t.darkGreenRatioPct ? "pass" : "fail",
    fmtPct(ratio)
  );

  const cfStatus: RuleStatus = u.cashFlowMonthly == null ? "unknown" : u.cashFlowMonthly > 0 ? "pass" : "fail";
  addRule("cashflow", "Positive estimated monthly cash flow", cfStatus, fmt$(u.cashFlowMonthly) + "/mo");

  const dscrGreen: RuleStatus = u.dscr == null ? "unknown" : u.dscr >= t.greenMinDscr ? "pass" : "fail";
  addRule("dscr_green", `DSCR ≥ ${t.greenMinDscr}`, dscrGreen, u.dscr == null ? "Unknown" : u.dscr.toFixed(2));
  addRule(
    "dscr_dark",
    `DSCR ≥ ${t.darkGreenMinDscr} (exceptional)`,
    u.dscr == null ? "unknown" : u.dscr >= t.darkGreenMinDscr ? "pass" : "fail",
    u.dscr == null ? "Unknown" : u.dscr.toFixed(2)
  );

  addRule(
    "flags",
    "No major negative property flags",
    flags.length === 0 ? "pass" : "fail",
    flags.length === 0 ? "None identified" : flags.join(" · ")
  );

  const capOk: RuleStatus = u.capRatePct == null ? "unknown" : u.capRatePct >= t.targetCapRatePct ? "pass" : "fail";
  addRule("cap_target", `Cap rate ≥ ${t.targetCapRatePct}% target`, capOk, fmtPct(u.capRatePct));
  const cocOk: RuleStatus = u.cocPct == null ? "unknown" : u.cocPct >= t.targetCocPct ? "pass" : "fail";
  addRule("coc_target", `Cash-on-cash ≥ ${t.targetCocPct}% target`, cocOk, fmtPct(u.cocPct));

  const strongCf: RuleStatus =
    cfPerUnit == null ? "unknown" : cfPerUnit >= t.darkGreenMinCfPerUnit ? "pass" : "fail";
  addRule(
    "strong_cf",
    `Cash flow ≥ $${t.darkGreenMinCfPerUnit}/unit/mo (exceptional)`,
    strongCf,
    cfPerUnit == null ? "Unknown" : `${fmt$(cfPerUnit)}/unit/mo`
  );

  // ── Color decision (RED checks first, then DARK_GREEN, GREEN, else YELLOW) ──
  let color: DealColor;
  let reason: string;

  const status = (k: string) => rules.find((r) => r.key === k)!.status;

  const redReasons: string[] = [];
  if (status("type") === "fail") redReasons.push("property type excluded by criteria");
  if (status("year") === "fail") redReasons.push(`built before ${t.minYearBuilt}`);
  if (ratio != null && ratio < t.yellowRatioFloorPct) redReasons.push(`rent-to-price ${ratio.toFixed(2)}% is below ${t.yellowRatioFloorPct}%`);
  if (u.cashFlowMonthly != null && u.cashFlowMonthly < 0) redReasons.push("negative estimated cash flow");
  if (u.dscr != null && u.dscr < 1.0) redReasons.push(`DSCR ${u.dscr.toFixed(2)} below 1.0`);
  if (flags.length) redReasons.push("major condition/legal/risk flags identified");

  if (redReasons.length > 0) {
    color = "RED";
    reason = `Weak deal: ${redReasons.join("; ")}.`;
  } else {
    const greenKeys = ["type", "year", "ratio_green", "cashflow", "dscr_green", "flags"];
    const greenUnknowns = greenKeys.filter((k) => status(k) === "unknown");
    const greenAllPass = greenKeys.every((k) => status(k) === "pass");

    if (greenAllPass) {
      const darkKeys = ["ratio_dark", "dscr_dark", "strong_cf", "cap_target", "coc_target"];
      const darkAllPass = darkKeys.every((k) => status(k) === "pass");
      if (darkAllPass) {
        color = "DARK_GREEN";
        reason = `Exceptional deal: ratio ${fmtPct(ratio)}, DSCR ${u.dscr!.toFixed(2)}, ${fmt$(cfPerUnit)}/unit/mo, cap and cash-on-cash above targets.`;
      } else {
        color = "GREEN";
        const near = darkKeys.filter((k) => status(k) !== "pass").map((k) => rules.find((r) => r.key === k)!.label);
        reason = `Strong deal: all core criteria met. Short of exceptional on: ${near.join("; ")}.`;
      }
    } else if (greenUnknowns.length > 0) {
      color = "YELLOW";
      const unknownLabels = greenUnknowns.map((k) => rules.find((r) => r.key === k)!.label);
      reason = `Needs review: missing information for ${unknownLabels.join("; ")}. Confidence reduced — unknowns are not treated as zero.`;
    } else {
      color = "YELLOW";
      const failed = greenKeys.filter((k) => status(k) === "fail").map((k) => rules.find((r) => r.key === k)!.label);
      reason = `Needs review: ${failed.join("; ")} not yet met. Could work after negotiation or rent increases.`;
    }
  }

  return { score, color, confidence, missingFields: missing, components, rules, flags, classificationReason: reason };
}
