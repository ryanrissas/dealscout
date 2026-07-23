import { ColorChip } from "@/components/ui/chips";
import { money, pct, num, dateShort } from "@/lib/format";
import type { Sec8Analysis } from "@/lib/scoring/section8";

export default function Sec8Panel({ sec8 }: { sec8: Sec8Analysis | null }) {
  if (!sec8) return null;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-blue-wash px-5 py-3">
        <div>
          <h2 className="text-lg font-semibold">Section 8 / HUD rent benchmark</h2>
          {sec8.available && (
            <div className="text-xs text-ink-faint">
              {sec8.areaName} · FY{sec8.fiscalYear} {sec8.usedSafmr ? "ZIP-level SAFMR" : "metro FMR"} · effective {dateShort(sec8.effectiveDate)} ·{" "}
              {sec8.sourceUrl && <a href={sec8.sourceUrl} target="_blank" rel="noreferrer" className="text-blue">HUD source ↗</a>}
            </div>
          )}
        </div>
        <ColorChip color={sec8.color} prefix="§8" />
      </div>

      <div className="p-5">
        {!sec8.available ? (
          <p className="text-sm text-ink-soft">{sec8.reasonUnavailable}</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Unit</th>
                  <th className="th text-right">Beds</th>
                  <th className="th text-right">Current rent</th>
                  <th className="th text-right">HUD benchmark</th>
                  <th className="th text-right">Payment std ({sec8.paymentStandardPct}%)</th>
                  <th className="th text-right">Utility allowance</th>
                  <th className="th text-right">Est. contract rent</th>
                </tr>
              </thead>
              <tbody>
                {sec8.units.map((u) => (
                  <tr key={u.label}>
                    <td className="td font-medium">{u.label}</td>
                    <td className="td mono text-right">{u.bedrooms}</td>
                    <td className="td mono text-right">{u.currentRent != null ? money(u.currentRent) : "Unknown"}</td>
                    <td className="td mono text-right">{money(u.hudBenchmark)}</td>
                    <td className="td mono text-right">{money(u.paymentStandardEst)}</td>
                    <td className="td mono text-right">{u.utilityAllowance != null ? money(u.utilityAllowance) : "Unknown"}</td>
                    <td className="td mono text-right font-semibold">{u.contractRentEst != null ? money(u.contractRentEst) : "Unknown"}</td>
                  </tr>
                ))}
                {sec8.totals && (
                  <tr className="bg-paper">
                    <td className="td font-semibold" colSpan={2}>Totals /mo</td>
                    <td className="td mono text-right font-semibold">{sec8.totals.currentActualRent != null ? money(sec8.totals.currentActualRent) : "Unknown"}</td>
                    <td className="td mono text-right font-semibold">{money(sec8.totals.hudGrossBenchmark)}</td>
                    <td className="td mono text-right font-semibold">{money(sec8.totals.paymentStandardEst)}</td>
                    <td className="td mono text-right font-semibold">{sec8.totals.utilityAllowance != null ? money(sec8.totals.utilityAllowance) : "Unknown"}</td>
                    <td className="td mono text-right font-bold">{sec8.totals.contractRentEst != null ? money(sec8.totals.contractRentEst) : "Unknown"}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-sm border border-hairline bg-white p-3">
                <div className="eyebrow">Uplift vs actual rent</div>
                <div className="mono mt-1 text-xl font-bold">
                  {sec8.totals?.upliftPct != null ? pct(sec8.totals.upliftPct, 1) : "Unknown"}
                </div>
                <div className="text-xs text-ink-faint">
                  {sec8.totals?.upliftMonthly != null ? `${money(sec8.totals.upliftMonthly)} /mo · ${money(sec8.totals.upliftAnnual)} /yr` : "Needs actual rent + full allowance data"}
                </div>
              </div>
              {sec8.hudScenario && (
                <>
                  <div className="rounded-sm border border-hairline bg-white p-3">
                    <div className="eyebrow">Cash flow at HUD rents</div>
                    <div className={`mono mt-1 text-xl font-bold ${(sec8.hudScenario.cashFlowMonthly ?? 0) < 0 ? "text-deal-red" : ""}`}>
                      {money(sec8.hudScenario.cashFlowMonthly)}
                    </div>
                    <div className="text-xs text-ink-faint">underwritten at {money(sec8.hudScenario.monthlyRentUsed)} /mo</div>
                  </div>
                  <div className="rounded-sm border border-hairline bg-white p-3">
                    <div className="eyebrow">DSCR / Cap / CoC at HUD rents</div>
                    <div className="mono mt-1 text-xl font-bold">{num(sec8.hudScenario.dscr)}</div>
                    <div className="text-xs text-ink-faint">cap {pct(sec8.hudScenario.capRatePct, 1)} · CoC {pct(sec8.hudScenario.cocPct, 1)}</div>
                  </div>
                </>
              )}
            </div>

            {sec8.reasons.length > 0 && (
              <ul className="mt-4 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
                {sec8.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            )}
            {sec8.dataNote && <p className="mt-2 text-xs text-deal-amber">{sec8.dataNote}</p>}
          </>
        )}
        <p className="mt-4 border-t border-hairline pt-3 text-xs text-ink-faint">{sec8.disclaimer}</p>
      </div>
    </section>
  );
}
