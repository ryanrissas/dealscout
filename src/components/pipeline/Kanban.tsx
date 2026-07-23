"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { stageLabel, money, pct } from "@/lib/format";
import { spineClass } from "@/components/ui/chips";

const STAGES = [
  "NEW", "REVIEWING", "CONTACT_AGENT", "UNDERWRITING", "OFFER_PLANNED",
  "OFFER_SUBMITTED", "UNDER_CONTRACT", "PASSED", "CLOSED",
] as const;

export interface KanbanCard {
  propertyId: string;
  stage: string;
  favorite: boolean;
  tags: string[];
  rejectionReason: string | null;
  street: string;
  city: string;
  price: number | null;
  score: number | null;
  color: string | null;
  ratio: number | null;
  cf: number | null;
}

export default function Kanban({ initial, editable }: { initial: KanbanCard[]; editable: boolean }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [pendingPass, setPendingPass] = useState<KanbanCard | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function move(propertyId: string, stage: string, rejectionReason?: string) {
    setCards((cs) => cs.map((c) => (c.propertyId === propertyId ? { ...c, stage, rejectionReason: rejectionReason ?? c.rejectionReason } : c)));
    setBusy(true);
    await fetch("/api/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, stage, ...(rejectionReason ? { rejectionReason } : {}) }),
    });
    setBusy(false);
    router.refresh();
  }

  function onDrop(stage: string) {
    setOverStage(null);
    if (!dragId || !editable) return;
    const card = cards.find((c) => c.propertyId === dragId);
    setDragId(null);
    if (!card || card.stage === stage) return;
    if (stage === "PASSED") {
      setPendingPass(card);
      setReason("");
      return;
    }
    void move(card.propertyId, stage);
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const col = cards.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
              onDrop={() => onDrop(stage)}
              className={`w-64 shrink-0 rounded-sm border ${overStage === stage ? "border-blue bg-blue-wash" : "border-hairline bg-surface"}`}
            >
              <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
                <span className="eyebrow">{stageLabel(stage)}</span>
                <span className="mono text-xs text-ink-faint">{col.length}</span>
              </div>
              <div className="min-h-24 space-y-2 p-2">
                {col.map((c) => (
                  <div
                    key={c.propertyId}
                    draggable={editable}
                    onDragStart={() => setDragId(c.propertyId)}
                    onDragEnd={() => setDragId(null)}
                    className={`relative overflow-hidden rounded-sm border border-hairline bg-white p-2.5 pl-3.5 shadow-card ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === c.propertyId ? "opacity-50" : ""}`}
                  >
                    <span className={`absolute inset-y-0 left-0 w-[3px] ${spineClass(c.color)}`} />
                    <div className="flex items-start justify-between gap-1">
                      <Link href={`/deals/${c.propertyId}`} className="text-sm font-medium leading-snug text-ink no-underline hover:text-blue">
                        {c.favorite && <Star size={11} className="mr-1 inline fill-deal-amber text-deal-amber" />}
                        {c.street}
                      </Link>
                      {c.score != null && <span className="mono text-xs font-bold">{c.score}</span>}
                    </div>
                    <div className="text-xs text-ink-faint">{c.city}</div>
                    <div className="mono mt-1.5 flex justify-between text-xs">
                      <span>{money(c.price)}</span>
                      <span className="font-semibold">{pct(c.ratio)}</span>
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-[1px] bg-paper px-1 py-0.5 text-[10px] text-ink-faint">{t}</span>
                        ))}
                      </div>
                    )}
                    {stage === "PASSED" && c.rejectionReason && (
                      <p className="mt-1.5 border-t border-hairline pt-1 text-[11px] leading-snug text-ink-faint">{c.rejectionReason}</p>
                    )}
                  </div>
                ))}
                {col.length === 0 && <div className="py-4 text-center text-xs text-ink-faint">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {pendingPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-md p-5">
            <h2 className="text-lg font-semibold">Pass on {pendingPass.street}?</h2>
            <p className="mt-1 text-sm text-ink-faint">A reason is required so the team knows why this deal was rejected.</p>
            <textarea
              autoFocus
              className="input mt-3"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Roof and foundation costs kill the cash flow at any realistic offer."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setPendingPass(null)}>Cancel</button>
              <button
                className="btn-danger"
                disabled={busy || reason.trim().length < 5}
                onClick={async () => {
                  await move(pendingPass.propertyId, "PASSED", reason.trim());
                  setPendingPass(null);
                }}
              >
                Pass on this deal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
