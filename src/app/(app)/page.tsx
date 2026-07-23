import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { fetchDeals } from "@/lib/dealQuery";
import { parseFilters } from "@/lib/filters";
import { money, pct, dateShort, typeLabel } from "@/lib/format";
import { ColorChip, ScoreChip, spineClass } from "@/components/ui/chips";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  const [byColor, unreadAlerts, pipelineActive, latestAlerts, sec8Dark] = await Promise.all([
    prisma.dealMetrics.groupBy({ by: ["color"], _count: true }),
    prisma.alert.count({ where: { userId: user!.id, read: false } }),
    prisma.pipelineItem.count({ where: { stage: { notIn: ["PASSED", "CLOSED"] } } }),
    prisma.alert.findMany({
      where: { userId: user!.id },
      include: { property: { select: { id: true, street: true, city: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.dealMetrics.count({ where: { sec8Color: "DARK_GREEN" } }),
  ]);
  const count = (c: string) => byColor.find((r) => r.color === c)?._count ?? 0;

  const top = (await fetchDeals(parseFilters({ colors: "DARK_GREEN,GREEN", sort: "score-desc" }))).slice(0, 6);

  const kpis = [
    { label: "Dark green", value: count("DARK_GREEN"), href: "/deals?colors=DARK_GREEN", tone: "text-deal-dark" },
    { label: "Green", value: count("GREEN"), href: "/deals?colors=GREEN", tone: "text-deal-green" },
    { label: "Yellow", value: count("YELLOW"), href: "/deals?colors=YELLOW", tone: "text-deal-amber" },
    { label: "Red", value: count("RED"), href: "/deals?colors=RED", tone: "text-deal-red" },
    { label: "Section 8 dark green", value: sec8Dark, href: "/deals?sec8Colors=DARK_GREEN", tone: "text-blue" },
    { label: "Active in pipeline", value: pipelineActive, href: "/pipeline", tone: "text-ink" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow">Toledo, OH · default market</div>
        <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-4 no-underline hover:shadow-raised transition-shadow">
            <div className={`mono text-3xl font-bold ${k.tone}`}>{k.value}</div>
            <div className="eyebrow mt-1">{k.label}</div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[7fr_5fr]">
        <div className="card">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <h2 className="text-lg font-semibold">Top opportunities</h2>
            <Link href="/deals" className="text-sm text-blue">All deals →</Link>
          </div>
          <ul>
            {top.map((p) => (
              <li key={p.id} className="relative border-b border-hairline last:border-0">
                <span className={`absolute inset-y-0 left-0 w-[3px] ${spineClass(p.metrics?.color)}`} />
                <Link href={`/deals/${p.id}`} className="flex items-center gap-4 px-4 py-3 pl-5 no-underline hover:bg-paper">
                  <ScoreChip score={p.metrics?.score} color={p.metrics?.color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.street}</div>
                    <div className="text-xs text-ink-faint">
                      {p.city} · {typeLabel(p.propertyType)} · {p.unitCount} unit{p.unitCount > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="mono text-right text-sm">
                    <div className="font-semibold">{pct(p.metrics?.rentToPricePct)}</div>
                    <div className="text-ink-faint">{money(p.primary?.price ?? null)}</div>
                  </div>
                </Link>
              </li>
            ))}
            {top.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-faint">
                No green deals yet. Run an ingestion from Settings to pull listings.
              </li>
            )}
          </ul>
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <h2 className="text-lg font-semibold">Latest alerts</h2>
            <Link href="/alerts" className="text-sm text-blue">All alerts →</Link>
          </div>
          <ul>
            {latestAlerts.map((a) => (
              <li key={a.id} className="border-b border-hairline px-4 py-3 last:border-0">
                <div className="flex items-start gap-2">
                  {!a.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-deal-amber" />}
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">{a.title}</div>
                    {a.reasons[0] && <div className="mt-0.5 truncate text-xs text-ink-faint">{a.reasons[0]}</div>}
                    <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                      <span>{dateShort(a.createdAt)}</span>
                      {a.property && (
                        <Link href={`/deals/${a.property.id}`} className="text-blue">View deal</Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {latestAlerts.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-faint">No alerts yet.</li>
            )}
          </ul>
          {unreadAlerts > 0 && (
            <div className="border-t border-hairline px-4 py-2 text-xs text-ink-faint">
              {unreadAlerts} unread alert{unreadAlerts > 1 ? "s" : ""}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
