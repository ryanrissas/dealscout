/**
 * DealScout underwriting engine.
 *
 * Pure functions — no I/O — so the same math runs on the server (metrics
 * snapshots, alerts), in the browser (live underwriting panel) and in tests.
 *
 * Conventions (documented because they are opinionated):
 *  - GPR  = gross potential rent (the selected rent basis at 100% occupancy)
 *  - Vacancy allowance   = vacancyPct × GPR
 *  - EGI  = effective gross income = GPR − vacancy
 *  - Management          = managementPct × EGI  (charged on collected rent)
 *  - Maintenance, CapEx  = pct × GPR            (conservative: scheduled rent)
 *  - Operating expenses exclude debt service (standard NOI definition)
 *  - Cap rate            = annual NOI ÷ price
 *  - DSCR                = annual NOI ÷ annual debt service
 *  - Cash flow           = NOI − debt service
 *  - Cash to close       = down payment + closing costs + rehab budget
 *  - Cash-on-cash        = annual cash flow ÷ cash to close
 *  - Break-even occupancy = (opex excl. vacancy + debt service) ÷ annual GPR
 *    (approximation: treats mgmt/maint/capex at stabilized levels)
 */

export interface FinancingAssumptions {
  downPaymentPct: number;   // 25 → 25%
  interestRatePct: number;  // 7.5 → 7.5% APR
  amortYears: number;       // 30
  closingCostPct: number;   // % of price, default 3
  rehabBudget: number;      // $ added to cash to close
}

export interface OpexAssumptions {
  vacancyPct: number;             // 5
  managementPct: number;          // 8
  maintenancePct: number;         // 5
  capexPct: number;               // 5
  insurancePerUnitAnnual: number; // $/unit/yr when no quote is known
  insuranceAnnualOverride?: number | null;
  taxesAnnualOverride?: number | null;   // else property tax record, else estimate
  taxEstimatePctOfPrice: number;         // fallback estimate, default 2.0 (Toledo-ish)
  ownerUtilitiesMonthlyOverride?: number | null;
  otherMonthly?: number;
}

export interface UnderwriteAssumptions {
  financing: FinancingAssumptions;
  opex: OpexAssumptions;
}

export const DEFAULT_ASSUMPTIONS: UnderwriteAssumptions = {
  financing: {
    downPaymentPct: 25,
    interestRatePct: 7.5,
    amortYears: 30,
    closingCostPct: 3,
    rehabBudget: 0,
  },
  opex: {
    vacancyPct: 5,
    managementPct: 8,
    maintenancePct: 5,
    capexPct: 5,
    insurancePerUnitAnnual: 600,
    insuranceAnnualOverride: null,
    taxesAnnualOverride: null,
    taxEstimatePctOfPrice: 2.0,
    ownerUtilitiesMonthlyOverride: null,
    otherMonthly: 0,
  },
};

export interface UnderwriteInput {
  price: number;
  monthlyGrossRent: number | null; // the SELECTED rent basis — provenance handled by caller
  unitCount: number;
  buildingSqft?: number | null;
  taxesAnnualKnown?: number | null;         // from county/listing records
  ownerUtilitiesMonthlyKnown?: number | null;
  estimatedRehab?: number | null;           // listing-reported rehab, used if assumption has none
}

export interface ExpenseLine {
  key: string;
  label: string;
  monthly: number;
  estimated: boolean; // true when the number came from an assumption, not a record
}

export interface UnderwriteResult {
  price: number;
  unitCount: number;
  monthlyGrossRent: number | null;
  annualGrossRent: number | null;
  rentToPricePct: number | null;   // monthly rent ÷ price × 100
  grossYieldPct: number | null;    // annual rent ÷ price × 100
  pricePerUnit: number;
  pricePerSqft: number | null;

  loanAmount: number;
  downPayment: number;
  monthlyDebtService: number;      // principal & interest
  annualDebtService: number;

  vacancyMonthly: number | null;
  egiMonthly: number | null;
  expenseLines: ExpenseLine[];     // taxes, insurance, utilities, mgmt, maint, capex, other
  totalOpexMonthly: number | null; // excludes debt service
  noiMonthly: number | null;
  noiAnnual: number | null;

  capRatePct: number | null;
  dscr: number | null;
  cashFlowMonthly: number | null;
  cashFlowAnnual: number | null;
  cashToClose: number;
  cocPct: number | null;
  breakEvenOccPct: number | null;

  taxesEstimated: boolean;
  utilitiesEstimated: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Standard amortized payment. Returns 0 for a zero loan; handles 0% rates. */
export function monthlyMortgagePayment(loan: number, annualRatePct: number, years: number): number {
  if (loan <= 0) return 0;
  const n = Math.round(years * 12);
  if (n <= 0) return loan;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return loan / n;
  const f = Math.pow(1 + r, n);
  return (loan * r * f) / (f - 1);
}

export function underwrite(input: UnderwriteInput, a: UnderwriteAssumptions): UnderwriteResult {
  const { price, unitCount } = input;
  const rent = input.monthlyGrossRent != null && input.monthlyGrossRent > 0 ? input.monthlyGrossRent : null;

  const downPayment = price * (a.financing.downPaymentPct / 100);
  const loanAmount = price - downPayment;
  const monthlyDebtService = monthlyMortgagePayment(loanAmount, a.financing.interestRatePct, a.financing.amortYears);
  const annualDebtService = monthlyDebtService * 12;

  // Taxes: override > known record > estimated % of price
  let taxesAnnual: number;
  let taxesEstimated = false;
  if (a.opex.taxesAnnualOverride != null) {
    taxesAnnual = a.opex.taxesAnnualOverride;
  } else if (input.taxesAnnualKnown != null) {
    taxesAnnual = input.taxesAnnualKnown;
  } else {
    taxesAnnual = price * (a.opex.taxEstimatePctOfPrice / 100);
    taxesEstimated = true;
  }

  const insuranceAnnual =
    a.opex.insuranceAnnualOverride != null
      ? a.opex.insuranceAnnualOverride
      : a.opex.insurancePerUnitAnnual * unitCount;

  let utilitiesMonthly: number;
  let utilitiesEstimated = false;
  if (a.opex.ownerUtilitiesMonthlyOverride != null) {
    utilitiesMonthly = a.opex.ownerUtilitiesMonthlyOverride;
  } else if (input.ownerUtilitiesMonthlyKnown != null) {
    utilitiesMonthly = input.ownerUtilitiesMonthlyKnown;
  } else {
    utilitiesMonthly = 0;
    utilitiesEstimated = true; // unknown ≠ zero — surfaced to the caller
  }

  const rehab = a.financing.rehabBudget > 0 ? a.financing.rehabBudget : input.estimatedRehab ?? 0;
  const cashToClose = downPayment + price * (a.financing.closingCostPct / 100) + rehab;

  const pricePerUnit = unitCount > 0 ? price / unitCount : price;
  const pricePerSqft = input.buildingSqft ? price / input.buildingSqft : null;

  let vacancyMonthly: number | null = null;
  let egiMonthly: number | null = null;
  let expenseLines: ExpenseLine[] = [];
  let totalOpexMonthly: number | null = null;
  let noiMonthly: number | null = null;
  let noiAnnual: number | null = null;
  let capRatePct: number | null = null;
  let dscr: number | null = null;
  let cashFlowMonthly: number | null = null;
  let cashFlowAnnual: number | null = null;
  let cocPct: number | null = null;
  let breakEvenOccPct: number | null = null;

  if (rent != null) {
    vacancyMonthly = rent * (a.opex.vacancyPct / 100);
    egiMonthly = rent - vacancyMonthly;
    const managementMonthly = egiMonthly * (a.opex.managementPct / 100);
    const maintenanceMonthly = rent * (a.opex.maintenancePct / 100);
    const capexMonthly = rent * (a.opex.capexPct / 100);
    const otherMonthly = a.opex.otherMonthly ?? 0;

    expenseLines = [
      { key: "taxes", label: "Property taxes", monthly: round2(taxesAnnual / 12), estimated: taxesEstimated },
      { key: "insurance", label: "Insurance", monthly: round2(insuranceAnnual / 12), estimated: a.opex.insuranceAnnualOverride == null },
      { key: "utilities", label: "Owner-paid utilities", monthly: round2(utilitiesMonthly), estimated: utilitiesEstimated },
      { key: "management", label: `Management (${a.opex.managementPct}% of EGI)`, monthly: round2(managementMonthly), estimated: true },
      { key: "maintenance", label: `Repairs & maintenance (${a.opex.maintenancePct}% of GPR)`, monthly: round2(maintenanceMonthly), estimated: true },
      { key: "capex", label: `CapEx reserve (${a.opex.capexPct}% of GPR)`, monthly: round2(capexMonthly), estimated: true },
    ];
    if (otherMonthly > 0) expenseLines.push({ key: "other", label: "Other", monthly: round2(otherMonthly), estimated: true });

    totalOpexMonthly = taxesAnnual / 12 + insuranceAnnual / 12 + utilitiesMonthly + managementMonthly + maintenanceMonthly + capexMonthly + otherMonthly;
    noiMonthly = egiMonthly - totalOpexMonthly;
    noiAnnual = noiMonthly * 12;
    capRatePct = price > 0 ? (noiAnnual / price) * 100 : null;
    dscr = annualDebtService > 0 ? noiAnnual / annualDebtService : null;
    cashFlowMonthly = noiMonthly - monthlyDebtService;
    cashFlowAnnual = cashFlowMonthly * 12;
    cocPct = cashToClose > 0 ? (cashFlowAnnual / cashToClose) * 100 : null;

    const annualGPR = rent * 12;
    const annualOpexExVacancy = totalOpexMonthly * 12;
    breakEvenOccPct = annualGPR > 0 ? ((annualOpexExVacancy + annualDebtService) / annualGPR) * 100 : null;
  }

  return {
    price,
    unitCount,
    monthlyGrossRent: rent,
    annualGrossRent: rent != null ? rent * 12 : null,
    rentToPricePct: rent != null && price > 0 ? (rent / price) * 100 : null,
    grossYieldPct: rent != null && price > 0 ? ((rent * 12) / price) * 100 : null,
    pricePerUnit,
    pricePerSqft,
    loanAmount,
    downPayment,
    monthlyDebtService,
    annualDebtService,
    vacancyMonthly,
    egiMonthly,
    expenseLines,
    totalOpexMonthly,
    noiMonthly,
    noiAnnual,
    capRatePct,
    dscr,
    cashFlowMonthly,
    cashFlowAnnual,
    cashToClose,
    cocPct,
    breakEvenOccPct,
    taxesEstimated,
    utilitiesEstimated,
  };
}

/** Merge partial overrides (e.g. market or per-property profiles) over base assumptions. */
export function mergeAssumptions(
  base: UnderwriteAssumptions,
  ...overrides: Array<Partial<{ financing: Partial<FinancingAssumptions>; opex: Partial<OpexAssumptions> }> | null | undefined>
): UnderwriteAssumptions {
  const out: UnderwriteAssumptions = {
    financing: { ...base.financing },
    opex: { ...base.opex },
  };
  for (const o of overrides) {
    if (!o) continue;
    if (o.financing) Object.assign(out.financing, stripUndefined(o.financing));
    if (o.opex) Object.assign(out.opex, stripUndefined(o.opex));
  }
  return out;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const r: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (r as Record<string, unknown>)[k] = v;
  return r;
}
