import { ColorChip, ScoreChip } from "@/components/ui/chips";
import { money } from "@/lib/format";

export interface Breakdown {
  components: Array<{ key: string; label: string; points: number; max: number; detail?: string }>;
  rules: Array<{ key: string; label: string; status: "pass" | "fail" | "unknown"; detail?: string }>;
  flags: string[];
  classificationReason: string;
  rentBasis: { kind: string; amount: number } | null;
  rentsByKind: Record<string, number | undefined>;
  expenseLines?: Array<{ key: string; label: string; monthly: number; estimated: boolean }>;
  taxesEstimated?: boolean;
  utilitiesEstimated?: boolean;
}

const RULE_TONE = {
  pass: "text-deal-green",
  fail: "text-deal-red",
  unknown: "text-deal-amber",
} as const;
const RULE_MARK = { pass: "✓", fail: "✕", unknown: "?" } as const;

export default function ScoreLedger({
  breakdown, score, color,
}: { breakdown: Breakdown | null; score: number | null; color: string | null }) {
  if (!breakdown) return null;
  const total = breakdown.components.reduce((a, c) => a + c.points, 0);
  const max = breakdown.components.reduce((a, c) => a + c.max, 0);
  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Score ledger</h2>
        <div className="flex items-center gap-2">
          <ScoreChip score={score} color={color} />
          <ColorChip color={color} />
        </div>
      </div>
      <p className="mb-4 text-xs text-ink-faint">
        Every point is itemized — the score is fully transparent. {breakdown.classificationReason}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Point components</div>
          <table className="w-full">
            <tbody>
              {breakdown.components.map((c) => (
                <tr key={c.key}>
                  <td className="td">
                    <div className="font-medium">{c.label}</div>
                    {c.detail && <div className="text-xs text-ink-faint">{c.detail}</div>}
                  </td>
                  <td className="td mono w-24 text-right">
                    <span className={c.points < 0 ? "text-deal-red font-semibold" : "font-semibold"}>{c.points}</span>
                    <span className="text-ink-faint"> / {c.max}</span>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="td font-semibold">Total</td>
                <td className="td mono text-right font-bold">{total} / {max}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <div className="eyebrow mb-2">Classification rules</div>
          <ul className="space-y-1.5">
            {breakdown.rules.map((r) => (
              <li key={r.key} className="flex items-start gap-2 border-b border-hairline pb-1.5 text-sm">
                <span className={`mono mt-0.5 w-4 font-bold ${RULE_TONE[r.status]}`}>{RULE_MARK[r.status]}</span>
                <span className="flex-1">
                  {r.label}
                  {r.detail && <span className="block text-xs text-ink-faint">{r.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          {breakdown.flags.length > 0 && (
            <div className="mt-3 rounded-sm border border-deal-red/30 bg-deal-redwash p-3 text-sm">
              <div className="eyebrow mb-1 text-deal-red">Major flags (−15 each)</div>
              <ul className="list-disc pl-4">{breakdown.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      {breakdown.expenseLines && breakdown.expenseLines.length > 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          <div className="eyebrow mb-2">Operating expenses used (monthly)</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            {breakdown.expenseLines.map((e) => (
              <div key={e.key} className="flex justify-between border-b border-hairline py-1 text-sm">
                <span className="text-ink-faint">{e.label}{e.estimated ? " (est.)" : ""}</span>
                <span className="mono">{money(e.monthly, true)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            "(est.)" marks values derived from assumptions rather than records{breakdown.taxesEstimated ? " — taxes are estimated from the price; confirm with the county" : ""}.
          </p>
        </div>
      )}
    </section>
  );
}
