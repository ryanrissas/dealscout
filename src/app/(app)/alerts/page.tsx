import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { dateShort } from "@/lib/format";
import AlertActions, { MarkAllRead } from "@/components/deals/AlertActions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  NEW_GREEN_DEAL: "New green deal",
  RATIO_TARGET_CROSSED: "Ratio target crossed",
  PRICE_REDUCTION: "Price reduction",
  DEAL_BECAME_VIABLE: "Deal became viable",
  STATUS_CHANGE: "Status change",
  STALE_LISTING_LEVERAGE: "Stale listing leverage",
};

export default async function AlertsPage() {
  const user = await currentUser();
  const alerts = await prisma.alert.findMany({
    where: { userId: user!.id },
    include: { property: { select: { id: true, street: true, city: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const unread = alerts.filter((a) => !a.read);
  const read = alerts.filter((a) => a.read);

  const Row = ({ a }: { a: (typeof alerts)[number] }) => (
    <li className="flex items-start gap-3 border-b border-hairline px-4 py-3 last:border-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.read ? "bg-hairline" : "bg-deal-amber"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{a.title}</span>
          <span className="eyebrow">{TYPE_LABEL[a.type] ?? a.type}</span>
        </div>
        {a.reasons.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-ink-soft">
            {a.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        )}
        <div className="mt-1 flex items-center gap-3 text-xs text-ink-faint">
          <span>{dateShort(a.createdAt)}</span>
          {a.property && <Link href={`/deals/${a.property.id}`} className="text-blue">Open {a.property.street}</Link>}
        </div>
      </div>
      {!a.read && <AlertActions id={a.id} />}
    </li>
  );

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Every alert explains why it fired</div>
          <h1 className="mt-1 text-3xl font-semibold">Alerts</h1>
        </div>
        {unread.length > 0 && <MarkAllRead />}
      </header>

      <section className="card">
        <div className="border-b border-hairline px-4 py-2.5">
          <span className="eyebrow">Unread · {unread.length}</span>
        </div>
        <ul>
          {unread.map((a) => <Row key={a.id} a={a} />)}
          {unread.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-faint">You're caught up.</li>}
        </ul>
      </section>

      {read.length > 0 && (
        <section className="card">
          <div className="border-b border-hairline px-4 py-2.5">
            <span className="eyebrow">Earlier · {read.length}</span>
          </div>
          <ul>{read.map((a) => <Row key={a.id} a={a} />)}</ul>
        </section>
      )}
    </div>
  );
}
