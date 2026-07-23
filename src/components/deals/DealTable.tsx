import Link from "next/link";
import type { DealRow } from "@/lib/dealQuery";
import { money, pct, num, typeLabel, int } from "@/lib/format";
import { ScoreChip, StatusChip, RentBasisChip, spineClass } from "@/components/ui/chips";
import { Star } from "lucide-react";

export default function DealTable({
  deals, query, compareIds,
}: { deals: DealRow[]; query: string; compareIds: string[] }) {
  const compareLink = (id: string) => {
    const next = compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id];
    return `/deals?${query}${next.length ? `&compare=${next.join(",")}` : ""}`;
  };
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse">
        <thead>
          <tr>
            <th className="th w-1">Score</th>
            <th className="th">Address</th>
            <th className="th">Type</th>
            <th className="th text-right">Price</th>
            <th className="th text-right">Rent /mo</th>
            <th className="th">Basis</th>
            <th className="th text-right">Ratio</th>
            <th className="th text-right">CF /mo</th>
            <th className="th text-right">DSCR</th>
            <th className="th text-right">Cap</th>
            <th className="th text-right">DOM</th>
            <th className="th">Status</th>
            <th className="th">Sec 8</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody>
          {deals.map((p) => (
            <tr key={p.id} className="relative hover:bg-paper">
              <td className="td relative pl-4">
                <span className={`absolute inset-y-0 left-0 w-[3px] ${spineClass(p.metrics?.color)}`} />
                <ScoreChip score={p.metrics?.score} color={p.metrics?.color} />
              </td>
              <td className="td">
                <Link href={`/deals/${p.id}`} className="font-medium text-ink no-underline hover:text-blue">
                  {p.pipeline?.favorite && <Star size={12} className="mr-1 inline fill-deal-amber text-deal-amber" />}
                  {p.street}
                </Link>
                <div className="text-xs text-ink-faint">{p.city} {p.zip}</div>
              </td>
              <td className="td whitespace-nowrap text-xs">{typeLabel(p.propertyType)}<div className="text-ink-faint">{int(p.unitCount)} unit{p.unitCount > 1 ? "s" : ""}</div></td>
              <td className="td mono text-right">{money(p.primary?.price ?? null)}
                {p.primary?.originalPrice != null && p.primary.price < p.primary.originalPrice && (
                  <div className="text-xs text-deal-green">↓ {money(p.primary.originalPrice)}</div>
                )}
              </td>
              <td className="td mono text-right">{money(p.metrics?.monthlyGrossRent)}</td>
              <td className="td"><RentBasisChip kind={p.metrics?.rentBasisUsed} /></td>
              <td className="td mono text-right font-semibold">{pct(p.metrics?.rentToPricePct)}</td>
              <td className={`td mono text-right ${((p.metrics?.cashFlowMonthly ?? 0) < 0) ? "text-deal-red" : ""}`}>{money(p.metrics?.cashFlowMonthly)}</td>
              <td className="td mono text-right">{num(p.metrics?.dscr)}</td>
              <td className="td mono text-right">{pct(p.metrics?.capRatePct, 1)}</td>
              <td className="td mono text-right">{p.dom ?? "—"}</td>
              <td className="td"><StatusChip status={p.primary?.status} /></td>
              <td className="td">{p.metrics?.sec8Color ? <ScoreChip score={null} color={p.metrics.sec8Color} /> : <span className="text-xs text-ink-faint">—</span>}</td>
              <td className="td whitespace-nowrap text-xs">
                <Link href={compareLink(p.id)} className={compareIds.includes(p.id) ? "text-deal-amber" : "text-blue"}>
                  {compareIds.includes(p.id) ? "Remove" : "Compare"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
