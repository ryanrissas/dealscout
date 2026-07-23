"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { underwrite, type UnderwriteAssumptions } from "@/lib/finance/underwriting";
import { money, pct, num, rentKindLabel } from "@/lib/format";

/**
 * Interactive underwriting. Runs the SAME pure engine used server-side
 * (src/lib/finance/underwriting.ts), so numbers always agree with the ledger.
 */

interface Props {
  propertyId: string;
  editable: boolean;
  price: number;
  unitCount: number;
  buildingSqft: number | null;
  taxesAnnualKnown: number | null;
  ownerUtilitiesMonthlyKnown: number | null;
  estimatedRehab: number | null;
  rentOptions: Array<{ kind: string; amount: number }>;
  defaultBasis: string | null;
  assumptions: UnderwriteAssumptions;
  scenarios: Array<{ id: string; name: string; rentBasis: string; createdAt: string }>;
}

export default function UnderwritingPanel(p: Props) {
  const router = useRouter();
  const [offerPrice, setOfferPrice] = useState(p.price);
  const [basis, setBasis] = useState<string>(p.defaultBasis ?? p.rentOptions[0]?.kind ?? "CUSTOM");
  const [customRent, setCustomRent] = useState<number>(p.rentOptions[0]?.amount ?? 0);
  const [a, setA] = useState<UnderwriteAssumptions>(p.assumptions);
  const [busy, setBusy] = useState(false);

  const rent = basis === "CUSTOM" ? (customRent || null) : p.rentOptions.find((r) => r.kind === basis)?.amount ?? null;

  const result = useMemo(
    () =>
      underwrite(
        {
          price: offerPrice || p.price,
          monthlyGrossRent: rent,
          unitCount: p.unitCount,
          buildingSqft: p.buildingSqft,
          taxesAnnualKnown: p.taxesAnnualKnown,
          ownerUtilitiesMonthlyKnown: p.ownerUtilitiesMonthlyKnown,
          estimatedRehab: p.estimatedRehab,
        },
        a
      ),
    [offerPrice, rent, a, p]
  );

  const setF = (k: keyof UnderwriteAssumptions["financing"], v: number) =>
    setA((prev) => ({ ...prev, financing: { ...prev.financing, [k]: v } }));
  const setO = (k: keyof UnderwriteAssumptions["opex"], v: number) =>
    setA((prev) => ({ ...prev, opex: { ...prev.opex, [k]: v } }));

  async function saveScenario() {
    const name = window.prompt("Name this scenario:", `${a.financing.downPaymentPct}% down @ ${a.financing.interestRatePct}%`);
    if (!name) return;
    setBusy(true);
    await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: p.propertyId,
        name,
        rentBasis: basis === "CUSTOM" ? "MARKET_ESTIMATE" : basis,
        assumptions: { ...a, offerPrice, monthlyRent: rent },
        results: {
          cashFlowMonthly: result.cashFlowMonthly,
          dscr: result.dscr,
          capRatePct: result.capRatePct,
          cocPct: result.cocPct,
          cashToClose: result.cashToClose,
        },
      }),
    });
    setBusy(false);
    router.refresh();
  }

  const numField = (
    label: string, value: number, onChange: (v: number) => void, step = 0.1, suffix?: string
  ) => (
    <div key={label}>
      <label className="label">{label}{suffix ? ` (${suffix})` : ""}</label>
      <input type="number" step={step} className="input mono" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">What-if underwriting</h2>
        {p.editable && (
          <button className="btn-ghost" onClick={saveScenario} disabled={busy}>
            {busy ? "Saving…" : "Save scenario"}
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-ink-faint">
        Live recalculation with the same engine used for the score ledger. Adjust the offer, rent basis, financing, or expenses.
      </p>

      <div className="grid gap-6 lg:grid-cols-[5fr_7fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {numField("Offer price", offerPrice, setOfferPrice, 500, "$")}
            <div>
              <label className="label">Rent basis</label>
              <select className="input" value={basis} onChange={(e) => setBasis(e.target.value)}>
                {p.rentOptions.map((r) => (
                  <option key={r.kind} value={r.kind}>{rentKindLabel(r.kind)} — ${r.amount.toLocaleString()}</option>
                ))}
                <option value="CUSTOM">Custom rent…</option>
              </select>
            </div>
            {basis === "CUSTOM" && numField("Custom rent /mo", customRent, setCustomRent, 25, "$")}
          </div>

          <div>
            <div className="eyebrow mb-2">Financing</div>
            <div className="grid grid-cols-2 gap-3">
              {numField("Down payment", a.financing.downPaymentPct, (v) => setF("downPaymentPct", v), 1, "%")}
              {numField("Interest rate", a.financing.interestRatePct, (v) => setF("interestRatePct", v), 0.125, "%")}
              {numField("Amortization", a.financing.amortYears, (v) => setF("amortYears", v), 1, "yrs")}
              {numField("Closing costs", a.financing.closingCostPct, (v) => setF("closingCostPct", v), 0.5, "%")}
              {numField("Rehab budget", a.financing.rehabBudget, (v) => setF("rehabBudget", v), 500, "$")}
            </div>
          </div>

          <div>
            <div className="eyebrow mb-2">Operating expenses</div>
            <div className="grid grid-cols-2 gap-3">
              {numField("Vacancy", a.opex.vacancyPct, (v) => setO("vacancyPct", v), 0.5, "% GPR")}
              {numField("Management", a.opex.managementPct, (v) => setO("managementPct", v), 0.5, "% EGI")}
              {numField("Maintenance", a.opex.maintenancePct, (v) => setO("maintenancePct", v), 0.5, "% GPR")}
              {numField("CapEx", a.opex.capexPct, (v) => setO("capexPct", v), 0.5, "% GPR")}
              {numField("Insurance", a.opex.insurancePerUnitAnnual, (v) => setO("insurancePerUnitAnnual", v), 25, "$/unit/yr")}
              {numField("Tax estimate", a.opex.taxEstimatePctOfPrice, (v) => setO("taxEstimatePctOfPrice", v), 0.1, "% price")}
            </div>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {[
              { label: "Rent-to-price", value: pct(result.rentToPricePct), strong: true },
              { label: "Cash flow /mo", value: money(result.cashFlowMonthly), strong: true, danger: (result.cashFlowMonthly ?? 0) < 0 },
              { label: "DSCR", value: num(result.dscr), strong: true },
              { label: "Cap rate", value: pct(result.capRatePct) },
              { label: "Cash-on-cash", value: pct(result.cocPct) },
              { label: "NOI /yr", value: money(result.noiAnnual) },
              { label: "Mortgage /mo", value: money(result.monthlyDebtService, true) },
              { label: "Cash to close", value: money(result.cashToClose) },
              { label: "Break-even occ.", value: pct(result.breakEvenOccPct, 1) },
            ].map((c) => (
              <div key={c.label}>
                <div className="eyebrow">{c.label}</div>
                <div className={`mono mt-0.5 ${c.strong ? "text-xl font-bold" : "text-base"} ${c.danger ? "text-deal-red" : ""} ${c.value === "Unknown" ? "text-sm text-ink-faint" : ""}`}>
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-hairline pt-3">
            <div className="eyebrow mb-1.5">Monthly expense detail</div>
            {result.expenseLines.map((e) => (
              <div key={e.key} className="flex justify-between border-b border-hairline py-1 text-sm">
                <span className="text-ink-faint">{e.label}{e.estimated ? " (est.)" : ""}</span>
                <span className="mono">{money(e.monthly, true)}</span>
              </div>
            ))}
            <div className="flex justify-between py-1 text-sm font-semibold">
              <span>Total opex (excl. debt)</span>
              <span className="mono">{result.totalOpexMonthly != null ? money(result.totalOpexMonthly, true) : "Unknown"}</span>
            </div>
          </div>

          {p.scenarios.length > 0 && (
            <div className="mt-4 border-t border-hairline pt-3">
              <div className="eyebrow mb-1.5">Saved scenarios</div>
              <ul className="space-y-1 text-sm">
                {p.scenarios.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-xs text-ink-faint">{rentKindLabel(s.rentBasis)} · {new Date(s.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
