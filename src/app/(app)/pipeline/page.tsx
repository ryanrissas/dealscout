import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";
import Kanban from "@/components/pipeline/Kanban";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const user = await currentUser();
  const items = await prisma.pipelineItem.findMany({
    include: {
      property: { include: { metrics: true, listings: { where: { isPrimary: true }, take: 1 } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const cards = items.map((it) => ({
    propertyId: it.propertyId,
    stage: it.stage,
    favorite: it.favorite,
    tags: it.tags,
    rejectionReason: it.rejectionReason,
    street: it.property.street,
    city: it.property.city,
    price: it.property.listings[0]?.price ?? null,
    score: it.property.metrics?.score ?? null,
    color: it.property.metrics?.color ?? null,
    ratio: it.property.metrics?.rentToPricePct ?? null,
    cf: it.property.metrics?.cashFlowMonthly ?? null,
  }));

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Nine acquisition stages</div>
        <h1 className="mt-1 text-3xl font-semibold">Pipeline</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Drag a deal between columns to move it. Passing a deal always asks for a reason.
        </p>
      </header>
      <Kanban initial={cards} editable={canEdit(user?.role)} />
    </div>
  );
}
