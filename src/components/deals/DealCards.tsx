import Link from "next/link";
import type { DealRow } from "@/lib/dealQuery";
import { money, pct, num, typeLabel } from "@/lib/format";
import { ColorChip, ScoreChip, StatusChip, spineClass } from "@/components/ui/chips";

export default function DealCards({ deals }: { deals: DealRow[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {deals.map((p) => (
        <Link key={p.id} href={`/deals/${p.id}`} className="card relative overflow-hidden no-underline transition-shadow hover:shadow-raised">
          <span className={`absolute inset-y-0 left-0 w-[3px] ${spineClass(p.metrics?.color)}`} />
          {p.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photos[0]} alt="" className="h-32 w-full object-cover" />
          )}
          <div className="p-4 pl-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium leading-snug">{p.street}</div>
                <div className="text-xs text-ink-faint">{p.city} {p.zip} · {typeLabel(p.propertyType)}</div>
              </div>
              <ScoreChip score={p.metrics?.score} color={p.metrics?.color} />
            </div>
            <div className="mono mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><div className="eyebrow">Price</div><div className="font-semibold">{money(p.primary?.price ?? null)}</div></div>
              <div><div className="eyebrow">Ratio</div><div className="font-semibold">{pct(p.metrics?.rentToPricePct)}</div></div>
              <div><div className="eyebrow">CF /mo</div><div className={`font-semibold ${((p.metrics?.cashFlowMonthly ?? 0) < 0) ? "text-deal-red" : ""}`}>{money(p.metrics?.cashFlowMonthly)}</div></div>
              <div><div className="eyebrow">DSCR</div><div>{num(p.metrics?.dscr)}</div></div>
              <div><div className="eyebrow">Cap</div><div>{pct(p.metrics?.capRatePct, 1)}</div></div>
              <div><div className="eyebrow">DOM</div><div>{p.dom ?? "—"}</div></div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ColorChip color={p.metrics?.color} />
              {p.metrics?.sec8Color && <ColorChip color={p.metrics.sec8Color} prefix="§8" />}
              <StatusChip status={p.primary?.status} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
