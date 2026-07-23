import { describe, it, expect } from "vitest";
import { underwrite, DEFAULT_ASSUMPTIONS, mergeAssumptions } from "@/lib/finance/underwriting";
import { scoreDeal, type DealScoreInput } from "@/lib/scoring/dealScore";
import { DEFAULT_SETTINGS } from "@/lib/scoring/thresholds";

const T = DEFAULT_SETTINGS.thresholds;

function makeInput(over: Partial<DealScoreInput> & { price: number; rent: number | null; units: number; taxes?: number | null }): DealScoreInput {
  const uw = underwrite(
    { price: over.price, monthlyGrossRent: over.rent, unitCount: over.units, buildingSqft: 2000, taxesAnnualKnown: over.taxes ?? 1800 },
    DEFAULT_ASSUMPTIONS
  );
  return {
    underwrite: uw,
    rentBasis: over.rent != null ? "ACTUAL" : null,
    propertyType: "DUPLEX",
    yearBuilt: 1958,
    occupancy: "OCCUPIED",
    codeViolations: null,
    floodZone: "Zone X (minimal)",
    conditionNotes: null,
    hasUnitMix: true,
    buildingSqft: 2000,
    ...over,
  };
}

describe("deal classification — spec rules", () => {
  it("DARK GREEN: 2.4% ratio, high DSCR, strong per-unit cash flow", () => {
    const r = scoreDeal(makeInput({ price: 70000, rent: 1700, units: 2, taxes: 1400 }), T);
    expect(r.color).toBe("DARK_GREEN");
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.rules.find((x) => x.key === "ratio_dark")!.status).toBe("pass");
    expect(r.confidence).toBe("HIGH");
  });

  it("GREEN: 1.6% ratio clears core rules but not exceptional bar", () => {
    const r = scoreDeal(makeInput({ price: 100000, rent: 1600, units: 2, taxes: 2000 }), T);
    expect(r.color).toBe("GREEN");
    expect(r.rules.find((x) => x.key === "ratio_green")!.status).toBe("pass");
    expect(r.rules.find((x) => x.key === "ratio_dark")!.status).toBe("fail");
    expect(r.classificationReason).toMatch(/Short of exceptional/);
  });

  it("YELLOW: ratio in the 1.0–1.49% review band", () => {
    const r = scoreDeal(makeInput({ price: 100000, rent: 1200, units: 2, taxes: 2000 }), T);
    expect(r.color).toBe("YELLOW");
    expect(r.classificationReason).toMatch(/negotiation or rent increases/);
  });

  it("YELLOW with Unknowns: no rent on file reduces confidence, is not treated as zero", () => {
    const r = scoreDeal(makeInput({ price: 100000, rent: null, units: 3 }), T);
    expect(r.color).toBe("YELLOW");
    expect(r.confidence).toBe("LOW");
    expect(r.missingFields.join(" ")).toMatch(/Rent/);
    expect(r.classificationReason).toMatch(/missing information/i);
  });

  it("RED: built before the minimum year", () => {
    const r = scoreDeal(makeInput({ price: 70000, rent: 1700, units: 2, yearBuilt: 1928 }), T);
    expect(r.color).toBe("RED");
    expect(r.classificationReason).toMatch(/built before 1950/);
  });

  it("RED: ratio below 1.0% and negative cash flow", () => {
    const r = scoreDeal(makeInput({ price: 200000, rent: 1500, units: 2 }), T);
    expect(r.color).toBe("RED");
    expect(r.classificationReason).toMatch(/below 1%|below 1.0%|0\.75% is below/);
  });

  it("RED: DSCR below 1.0 is called out", () => {
    // ratio 1.03% passes the floor; heavy taxes push DSCR under 1.0
    const uw = underwrite(
      { price: 165000, monthlyGrossRent: 1700, unitCount: 2, buildingSqft: 2000, taxesAnnualKnown: 4800 },
      DEFAULT_ASSUMPTIONS
    );
    expect(uw.dscr!).toBeLessThan(1.0);
    const r = scoreDeal(makeInput({ price: 165000, rent: 1700, units: 2, taxes: 4800 }), T);
    expect(r.color).toBe("RED");
    expect(r.classificationReason).toMatch(/DSCR/);
  });

  it("RED: major flags (code violations) force weak classification", () => {
    const r = scoreDeal(makeInput({ price: 70000, rent: 1700, units: 2, codeViolations: "Open housing-code case #24-1188" }), T);
    expect(r.color).toBe("RED");
    expect(r.flags.length).toBe(1);
  });

  it("single-family is evaluated identically — strong SFR goes DARK GREEN", () => {
    const r = scoreDeal(makeInput({ price: 58000, rent: 1250, units: 1, propertyType: "SINGLE_FAMILY", taxes: 1200 }), T);
    expect(r.color).toBe("DARK_GREEN");
  });

  it("custom thresholds are honored (min year 1900; type exclusions)", () => {
    const relaxed = { ...T, minYearBuilt: 1900 };
    const r1 = scoreDeal(makeInput({ price: 70000, rent: 1700, units: 2, yearBuilt: 1928 }), relaxed);
    expect(r1.color).not.toBe("RED");
    const mfOnly = { ...T, allowedPropertyTypes: T.allowedPropertyTypes.filter((x) => x !== "SINGLE_FAMILY") };
    const r2 = scoreDeal(makeInput({ price: 58000, rent: 1250, units: 1, propertyType: "SINGLE_FAMILY" }), mfOnly);
    expect(r2.color).toBe("RED");
  });

  it("score ledger is transparent and sums to the score", () => {
    const r = scoreDeal(makeInput({ price: 70000, rent: 1700, units: 2, taxes: 1400 }), T);
    const sum = r.components.reduce((s, c) => s + c.points, 0);
    expect(Math.max(0, Math.min(100, sum))).toBe(r.score);
    expect(r.components.find((c) => c.key === "ratio")!.max).toBe(35);
  });
});
