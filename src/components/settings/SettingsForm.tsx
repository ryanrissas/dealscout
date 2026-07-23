"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSettings } from "@/lib/scoring/thresholds";
import type { UnderwriteAssumptions } from "@/lib/finance/underwriting";
import { typeLabel } from "@/lib/format";

const ALL_TYPES = ["SINGLE_FAMILY", "DUPLEX", "TRIPLEX", "FOURPLEX", "MULTI_5_20", "MULTI_20_PLUS"] as const;

export default function SettingsForm({
  settings: initialSettings, assumptions: initialAssumptions,
}: { settings: AppSettings; assumptions: UnderwriteAssumptions }) {
  const router = useRouter();
  const [s, setS] = useState(initialSettings);
  const [a, setA] = useState(initialAssumptions);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(null);
    setError(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: s, assumptions: a }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Save failed — check the values and try again.");
      return;
    }
    const data = (await res.json()) as { recomputed?: number };
    setSaved(`Saved. Recomputed metrics for ${data.recomputed ?? 0} properties.`);
    router.refresh();
  }

  const N = (label: string, value: number, onChange: (v: number) => void, step = 0.1, hint?: string) => (
    <div key={label}>
      <label className="label">{label}{hint ? <span className="text-ink-faint"> — {hint}</span> : ""}</label>
      <input type="number" step={step} className="input mono" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );

  const setT = <K extends keyof AppSettings["thresholds"]>(k: K, v: AppSettings["thresholds"][K]) =>
    setS((p) => ({ ...p, thresholds: { ...p.thresholds, [k]: v } }));
  const set8 = <K extends keyof AppSettings["section8"]>(k: K, v: AppSettings["section8"][K]) =>
    setS((p) => ({ ...p, section8: { ...p.section8, [k]: v } }));
  const setAl = <K extends keyof AppSettings["alerts"]>(k: K, v: AppSettings["alerts"][K]) =>
    setS((p) => ({ ...p, alerts: { ...p.alerts, [k]: v } }));
  const setF = (k: keyof UnderwriteAssumptions["financing"], v: number) =>
    setA((p) => ({ ...p, financing: { ...p.financing, [k]: v } }));
  const setO = (k: keyof UnderwriteAssumptions["opex"], v: number) =>
    setA((p) => ({ ...p, opex: { ...p.opex, [k]: v } }));

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Global underwriting assumptions</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {N("Down payment %", a.financing.downPaymentPct, (v) => setF("downPaymentPct", v), 1)}
          {N("Interest rate %", a.financing.interestRatePct, (v) => setF("interestRatePct", v), 0.125)}
          {N("Amortization yrs", a.financing.amortYears, (v) => setF("amortYears", v), 1)}
          {N("Closing costs %", a.financing.closingCostPct, (v) => setF("closingCostPct", v), 0.5)}
          {N("Vacancy % GPR", a.opex.vacancyPct, (v) => setO("vacancyPct", v), 0.5)}
          {N("Management % EGI", a.opex.managementPct, (v) => setO("managementPct", v), 0.5)}
          {N("Maintenance % GPR", a.opex.maintenancePct, (v) => setO("maintenancePct", v), 0.5)}
          {N("CapEx % GPR", a.opex.capexPct, (v) => setO("capexPct", v), 0.5)}
          {N("Insurance $/unit/yr", a.opex.insurancePerUnitAnnual, (v) => setO("insurancePerUnitAnnual", v), 25)}
          {N("Tax estimate % price", a.opex.taxEstimatePctOfPrice, (v) => setO("taxEstimatePctOfPrice", v), 0.1, "used only when county taxes unknown")}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold">Deal color thresholds</h2>
        <p className="mb-3 text-xs text-ink-faint">
          These drive the transparent 0–100 score and the green/yellow/red classification.
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {N("Min year built", s.thresholds.minYearBuilt, (v) => setT("minYearBuilt", v), 1, "older is red")}
          {N("Green ratio %", s.thresholds.greenRatioPct, (v) => setT("greenRatioPct", v))}
          {N("Dark green ratio %", s.thresholds.darkGreenRatioPct, (v) => setT("darkGreenRatioPct", v))}
          {N("Yellow ratio floor %", s.thresholds.yellowRatioFloorPct, (v) => setT("yellowRatioFloorPct", v))}
          {N("Green min DSCR", s.thresholds.greenMinDscr, (v) => setT("greenMinDscr", v), 0.05)}
          {N("Dark green min DSCR", s.thresholds.darkGreenMinDscr, (v) => setT("darkGreenMinDscr", v), 0.05)}
          {N("Target cap rate %", s.thresholds.targetCapRatePct, (v) => setT("targetCapRatePct", v), 0.5)}
          {N("Target CoC %", s.thresholds.targetCocPct, (v) => setT("targetCocPct", v), 0.5)}
          {N("Dark green CF $/unit/mo", s.thresholds.darkGreenMinCfPerUnit, (v) => setT("darkGreenMinCfPerUnit", v), 10)}
        </div>
        <fieldset className="mt-4">
          <legend className="eyebrow mb-1.5">Allowed property types (others classify red)</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {ALL_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.thresholds.allowedPropertyTypes.includes(t)}
                  onChange={(e) =>
                    setT(
                      "allowedPropertyTypes",
                      e.target.checked
                        ? [...s.thresholds.allowedPropertyTypes, t]
                        : s.thresholds.allowedPropertyTypes.filter((x) => x !== t)
                    )
                  }
                />
                {typeLabel(t)}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold">Section 8 evaluation</h2>
        <p className="mb-3 text-xs text-ink-faint">
          HUD FMR/SAFMR figures are benchmarks; approved rents come from the housing authority and are not guaranteed.
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {N("Payment standard %", s.section8.paymentStandardPct, (v) => set8("paymentStandardPct", v), 1, "90–110 typical")}
          {N("Green min DSCR", s.section8.greenMinDscr, (v) => set8("greenMinDscr", v), 0.05)}
          {N("Dark green min DSCR", s.section8.darkGreenMinDscr, (v) => set8("darkGreenMinDscr", v), 0.05)}
          {N("Dark green CF $/unit/mo", s.section8.darkGreenMinCfPerUnit, (v) => set8("darkGreenMinCfPerUnit", v), 10)}
          {N("Dark green uplift %", s.section8.darkGreenUpliftPct, (v) => set8("darkGreenUpliftPct", v), 1)}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Alert rules</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {N("Ratio target %", s.alerts.ratioTargetPct, (v) => setAl("ratioTargetPct", v), 0.1, "fires when a deal crosses this")}
          {N("Price drop min %", s.alerts.priceDropMinPct, (v) => setAl("priceDropMinPct", v), 0.5)}
          {N("Stale listing days", s.alerts.staleListingDays, (v) => setAl("staleListingDays", v), 5, "negotiation leverage alert")}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving & recomputing…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-deal-green">{saved}</span>}
        {error && <span className="text-sm text-deal-red">{error}</span>}
      </div>
    </div>
  );
}
