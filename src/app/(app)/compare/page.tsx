import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, pct, num, int, typeLabel, rentKindLabel, daysOnMarket } from "@/lib/format";
import { ColorChip, ScoreChip, RentBasisChip, spineClass } from "@/components/ui/chips";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const ids = String(searchParams.ids ?? "").split(",").filter(Boolean).slice(0, 5);
  const props = ids.length
    ? await prisma.property.findMany({
        where: { id: { in: ids } },
        include: { metrics: true, listings: { include: { source: true } } },
      })
    : [];
  const deals = ids
    .map((id) => props.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({ ...p, primary: p.listings.find((l) => l.isPrimary) ?? p.listings[0] ?? null }));

  if (deals.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <div className="eyebrow">Side by side</div>
          <h1 className="mt-1 text-3xl font-semibold">Compare</h1>
        </header>
        <div className="card px-6 py-12 text-center text-sm text-ink-faint">
          Nothing selected. Open <Link href="/deals" className="text-blue">Deals</Link> and use the
          "Compare" link on each row to pick up to five properties.
        </div>
      </div>
    );
  }

  const rows: Array<{ label: string; get: (d: (typeof deals)[number]) => React.ReactNode }> = [
    { label: "Score", get: (d) => <ScoreChip score={d.metrics?.score} color={d.metrics?.color} /> },
    { label: "Color", get: (d) => <ColorChip color={d.metrics?.color} /> },
    { label: "Price", get: (d) => <span className="mono font-semibold">{money(d.primary?.price ?? null)}</span> },
    { label: "Type / units", get: (d) => `${typeLabel(d.propertyType)} · ${int(d.unitCount)}` },
    { label: "Year built", get: (d) => d.yearBuilt ?? "Unknown" },
    { label: "Rent /mo", get: (d) => <span className="mono">{money(d.metrics?.monthlyGrossRent)}</span> },
    { label: "Rent basis", get: (d) => <RentBasisChip kind={d.metrics?.rentBasisUsed} /> },
    { label: "Rent-to-price", get: (d) => <span className="mono font-semibold">{pct(d.metrics?.rentToPricePct)}</span> },
    { label: "Gross yield", get: (d) => <span className="mono">{pct(d.metrics?.grossYieldPct, 1)}</span> },
    { label: "Cash flow /mo", get: (d) => <span className={`mono ${(d.metrics?.cashFlowMonthly ?? 0) < 0 ? "text-deal-red" : ""}`}>{money(d.metrics?.cashFlowMonthly)}</span> },
    { label: "DSCR", get: (d) => <span className="mono">{num(d.metrics?.dscr)}</span> },
    { label: "Cap rate", get: (d) => <span className="mono">{pct(d.metrics?.capRatePct)}</span> },
    { label: "Cash-on-cash", get: (d) => <span className="mono">{pct(d.metrics?.cocPct)}</span> },
    { label: "Cash to close", get: (d) => <span className="mono">{money(d.metrics?.cashToClose)}</span> },
    { label: "Break-even occ.", get: (d) => <span className="mono">{pct(d.metrics?.breakEvenOccPct, 1)}</span> },
    { label: "Price / unit", get: (d) => <span className="mono">{money(d.metrics?.pricePerUnit)}</span> },
    { label: "Sec 8 color", get: (d) => d.metrics?.sec8Color ? <ColorChip color={d.metrics.sec8Color} prefix="§8" /> : "—" },
    { label: "HUD gross /mo", get: (d) => <span className="mono">{money(d.metrics?.hudMonthlyGross)}</span> },
    { label: "Days on market", get: (d) => daysOnMarket(d.primary?.listDate ?? null) ?? "Unknown" },
    { label: "Source", get: (d) => d.primary?.source.name ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Side by side</div>
          <h1 className="mt-1 text-3xl font-semibold">Compare</h1>
        </div>
        <Link href="/deals" className="btn-ghost no-underline">Back to deals</Link>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="th w-44" />
              {deals.map((d) => (
                <th key={d.id} className="th relative min-w-52 !normal-case !tracking-normal">
                  <span className={`absolute inset-x-0 top-0 h-[3px] ${spineClass(d.metrics?.color)}`} />
                  <Link href={`/deals/${d.id}`} className="text-sm font-semibold text-ink no-underline hover:text-blue">
                    {d.street}
                  </Link>
                  <div className="text-xs font-normal text-ink-faint">{d.city} {d.zip}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-paper">
                <td className="td eyebrow">{r.label}</td>
                {deals.map((d) => (
                  <td key={d.id} className="td">{r.get(d)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
