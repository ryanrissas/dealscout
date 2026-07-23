import { describe, it, expect } from "vitest";
import { underwrite, monthlyMortgagePayment, mergeAssumptions, DEFAULT_ASSUMPTIONS } from "@/lib/finance/underwriting";

describe("monthlyMortgagePayment", () => {
  it("computes a standard 30-year payment", () => {
    // $52,500 loan (75% LTV on $70,000) at 7.5% / 30yr
    expect(monthlyMortgagePayment(52500, 7.5, 30)).toBeCloseTo(367.1, 0);
  });
  it("handles zero rate and zero loan", () => {
    expect(monthlyMortgagePayment(36000, 0, 30)).toBeCloseTo(100, 5);
    expect(monthlyMortgagePayment(0, 7.5, 30)).toBe(0);
  });
});

describe("underwrite — the $70k / $1,700 duplex example", () => {
  const r = underwrite(
    { price: 70000, monthlyGrossRent: 1700, unitCount: 2, buildingSqft: 1800, taxesAnnualKnown: null, ownerUtilitiesMonthlyKnown: null },
    DEFAULT_ASSUMPTIONS
  );
  it("rent-to-price and gross yield", () => {
    expect(r.rentToPricePct).toBeCloseTo(2.4286, 3);
    expect(r.grossYieldPct).toBeCloseTo(29.14, 1);
    expect(r.annualGrossRent).toBe(20400);
  });
  it("financing", () => {
    expect(r.downPayment).toBe(17500);
    expect(r.loanAmount).toBe(52500);
    expect(r.monthlyDebtService).toBeCloseTo(367.1, 0);
  });
  it("expenses, NOI, cap rate", () => {
    // vacancy 85 · EGI 1615 · mgmt 129.20 · maint 85 · capex 85 · taxes est 116.67 · ins 100
    expect(r.vacancyMonthly).toBeCloseTo(85, 5);
    expect(r.egiMonthly).toBeCloseTo(1615, 5);
    expect(r.totalOpexMonthly!).toBeCloseTo(515.87, 1);
    expect(r.noiAnnual!).toBeCloseTo(13189.6, 0);
    expect(r.capRatePct!).toBeCloseTo(18.84, 1);
    expect(r.taxesEstimated).toBe(true);
    expect(r.utilitiesEstimated).toBe(true);
  });
  it("DSCR, cash flow, cash-on-cash, break-even", () => {
    expect(r.dscr!).toBeCloseTo(2.99, 1);
    expect(r.cashFlowMonthly!).toBeCloseTo(732, 0);
    expect(r.cashToClose).toBeCloseTo(19600, 5); // 25% down + 3% closing
    expect(r.cocPct!).toBeCloseTo(44.8, 0);
    expect(r.breakEvenOccPct!).toBeCloseTo(51.9, 0);
    expect(r.pricePerUnit).toBe(35000);
    expect(r.pricePerSqft!).toBeCloseTo(38.89, 1);
  });
});

describe("underwrite — data provenance & edge cases", () => {
  it("uses known taxes/utilities over estimates and reports it", () => {
    const r = underwrite(
      { price: 100000, monthlyGrossRent: 1500, unitCount: 2, taxesAnnualKnown: 2400, ownerUtilitiesMonthlyKnown: 120 },
      DEFAULT_ASSUMPTIONS
    );
    expect(r.taxesEstimated).toBe(false);
    expect(r.utilitiesEstimated).toBe(false);
    expect(r.expenseLines.find((l) => l.key === "taxes")!.monthly).toBeCloseTo(200, 5);
    expect(r.expenseLines.find((l) => l.key === "utilities")!.monthly).toBe(120);
  });
  it("returns nulls (never fake zeros) when rent is unknown", () => {
    const r = underwrite({ price: 100000, monthlyGrossRent: null, unitCount: 4 }, DEFAULT_ASSUMPTIONS);
    expect(r.rentToPricePct).toBeNull();
    expect(r.noiAnnual).toBeNull();
    expect(r.dscr).toBeNull();
    expect(r.cashFlowMonthly).toBeNull();
    expect(r.pricePerUnit).toBe(25000); // price-based facts still computed
  });
  it("adds rehab budget to cash to close and honors overrides", () => {
    const a = mergeAssumptions(DEFAULT_ASSUMPTIONS, { financing: { rehabBudget: 15000, downPaymentPct: 20 }, opex: { taxesAnnualOverride: 1800 } });
    const r = underwrite({ price: 100000, monthlyGrossRent: 1500, unitCount: 2 }, a);
    expect(r.downPayment).toBe(20000);
    expect(r.cashToClose).toBe(20000 + 3000 + 15000);
    expect(r.expenseLines.find((l) => l.key === "taxes")!.monthly).toBe(150);
    expect(r.taxesEstimated).toBe(false);
  });
  it("100% down → DSCR is null (no debt), cash flow equals NOI", () => {
    const a = mergeAssumptions(DEFAULT_ASSUMPTIONS, { financing: { downPaymentPct: 100 } });
    const r = underwrite({ price: 80000, monthlyGrossRent: 1600, unitCount: 2, taxesAnnualKnown: 1600 }, a);
    expect(r.dscr).toBeNull();
    expect(r.cashFlowMonthly).toBeCloseTo(r.noiMonthly!, 5);
  });
});
