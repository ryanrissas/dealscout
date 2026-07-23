import { describe, it, expect } from "vitest";
import { analyzeSection8 } from "@/lib/scoring/section8";
import { findFmrForZip } from "@/lib/hud/lookup";
import { HUD_FMR_SEED, UTILITY_ALLOWANCE_SEED } from "@/lib/hud/fmrData";
import { DEFAULT_ASSUMPTIONS } from "@/lib/finance/underwriting";
import { DEFAULT_SETTINGS } from "@/lib/scoring/thresholds";

const base = {
  fmrLookup: findFmrForZip(HUD_FMR_SEED, "43605"),
  utilityAllowances: UTILITY_ALLOWANCE_SEED,
  assumptions: DEFAULT_ASSUMPTIONS,
  thresholds: DEFAULT_SETTINGS.section8,
};

describe("Section 8 opportunity analysis", () => {
  it("computes per-unit HUD benchmarks and totals for a 2×2BR duplex", () => {
    const r = analyzeSection8({
      ...base,
      units: [
        { label: "Unit 1", bedrooms: 2, currentRent: 850 },
        { label: "Unit 2", bedrooms: 2, currentRent: 825 },
      ],
      currentActualRentTotal: 1675,
      underwriteInput: { price: 69900, unitCount: 2, taxesAnnualKnown: 1500 },
    });
    expect(r.available).toBe(true);
    expect(r.usedSafmr).toBe(true);
    expect(r.units[0].hudBenchmark).toBe(1080); // 43605 2BR SAFMR
    expect(r.totals!.hudGrossBenchmark).toBe(2160);
    expect(r.totals!.utilityAllowance).toBe(300);
    expect(r.totals!.contractRentEst).toBe(1860); // 100% payment standard − allowances
    expect(r.totals!.upliftMonthly).toBe(185);
    expect(r.totals!.upliftAnnual).toBe(185 * 12);
    expect(r.hudScenario!.dscr!).toBeGreaterThan(1.5);
    // strong economics but uplift < 15% → GREEN, not DARK_GREEN
    expect(r.color).toBe("GREEN");
    expect(r.disclaimer).toMatch(/not guaranteed/i);
  });

  it("DARK GREEN when HUD benchmark is meaningfully above current rent with exceptional cash flow", () => {
    const r = analyzeSection8({
      ...base,
      units: [
        { label: "Unit 1", bedrooms: 2, currentRent: 750 },
        { label: "Unit 2", bedrooms: 2, currentRent: 750 },
      ],
      currentActualRentTotal: 1500,
      underwriteInput: { price: 69900, unitCount: 2, taxesAnnualKnown: 1500 },
    });
    expect(r.totals!.upliftPct!).toBeGreaterThanOrEqual(15);
    expect(r.color).toBe("DARK_GREEN");
    expect(r.reasons.join(" ")).toMatch(/above current rent/);
  });

  it("YELLOW when the utility-allowance schedule is missing (needs housing-authority confirmation)", () => {
    const r = analyzeSection8({
      ...base,
      utilityAllowances: [],
      units: [{ label: "Unit 1", bedrooms: 2, currentRent: 800 }],
      currentActualRentTotal: 800,
      underwriteInput: { price: 45000, unitCount: 1, taxesAnnualKnown: 900 },
    });
    expect(r.color).toBe("YELLOW");
    expect(r.reasons.join(" ")).toMatch(/housing authority/i);
    expect(r.totals!.contractRentEst).toBeNull(); // never fabricated
  });

  it("RED when HUD-supported rent cannot cover expenses and debt", () => {
    const r = analyzeSection8({
      ...base,
      fmrLookup: findFmrForZip(HUD_FMR_SEED, "43604"),
      units: [
        { label: "Unit 1", bedrooms: 2, currentRent: null },
        { label: "Unit 2", bedrooms: 2, currentRent: null },
      ],
      currentActualRentTotal: null,
      underwriteInput: { price: 300000, unitCount: 2, taxesAnnualKnown: 6000 },
    });
    expect(r.color).toBe("RED");
    expect(r.reasons.join(" ")).toMatch(/non-positive cash flow|below 1.0/);
  });

  it("payment-standard percentage is configurable", () => {
    const r = analyzeSection8({
      ...base,
      thresholds: { ...DEFAULT_SETTINGS.section8, paymentStandardPct: 110 },
      units: [{ label: "Unit 1", bedrooms: 3, currentRent: null }],
      currentActualRentTotal: null,
      underwriteInput: { price: 90000, unitCount: 1, taxesAnnualKnown: 1800 },
    });
    expect(r.units[0].paymentStandardEst).toBe(Math.round(1390 * 1.1)); // 43605 3BR × 110%
  });

  it("unavailable without unit bedroom data — never guesses", () => {
    const r = analyzeSection8({
      ...base,
      units: [{ label: "Unit 1", bedrooms: null, currentRent: null }],
      currentActualRentTotal: null,
      underwriteInput: { price: 50000, unitCount: 1 },
    });
    expect(r.available).toBe(false);
    expect(r.color).toBe("YELLOW");
  });
});
