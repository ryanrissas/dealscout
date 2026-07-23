"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { stageLabel } from "@/lib/format";

const STAGES = ["NEW", "REVIEWING", "CONTACT_AGENT", "UNDERWRITING", "OFFER_PLANNED", "OFFER_SUBMITTED", "UNDER_CONTRACT", "PASSED", "CLOSED"];

interface PipelineInfo { stage: string; favorite: boolean; tags: string[]; rejectionReason: string | null }

export default function PipelineControls({
  propertyId, pipeline, editable,
}: { propertyId: string; pipeline: PipelineInfo | null; editable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tagInput, setTagInput] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, ...body }),
    });
    setBusy(false);
    router.refresh();
  }

  function onStageChange(stage: string) {
    if (stage === "PASSED") { setRejectOpen(true); return; }
    void patch({ stage });
  }

  return (
    <section className="card p-4">
      <div className="eyebrow mb-2">Pipeline</div>
      {!pipeline && (
        <p className="mb-3 text-sm text-ink-faint">Not tracked yet.</p>
      )}
      {editable ? (
        <>
          <div className="flex items-center gap-2">
            <select
              className="input flex-1"
              value={pipeline?.stage ?? ""}
              onChange={(e) => onStageChange(e.target.value)}
              disabled={busy}
            >
              {!pipeline && <option value="">Add to pipeline…</option>}
              {STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
            <button
              className="btn-ghost px-2.5"
              aria-label={pipeline?.favorite ? "Remove favorite" : "Mark favorite"}
              onClick={() => patch({ favorite: !(pipeline?.favorite ?? false) })}
              disabled={busy}
            >
              <Star size={16} className={pipeline?.favorite ? "fill-deal-amber text-deal-amber" : "text-ink-faint"} />
            </button>
          </div>

          {rejectOpen && (
            <div className="mt-3 rounded-sm border border-deal-red/30 bg-deal-redwash p-3">
              <label className="label" htmlFor="reject-reason">Why are you passing? A reason is required.</label>
              <textarea id="reject-reason" className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ratio can't reach 1.5% even at a 15% price cut." />
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-danger"
                  disabled={busy || reason.trim().length < 5}
                  onClick={async () => { await patch({ stage: "PASSED", rejectionReason: reason.trim() }); setRejectOpen(false); setReason(""); }}
                >
                  Pass on this deal
                </button>
                <button className="btn-ghost" onClick={() => setRejectOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {(pipeline?.tags ?? []).map((t) => (
                <button
                  key={t}
                  className="rounded-sm border border-hairline bg-white px-2 py-0.5 text-xs hover:border-deal-red hover:text-deal-red"
                  title="Remove tag"
                  onClick={() => patch({ tags: (pipeline?.tags ?? []).filter((x) => x !== t) })}
                >
                  {t} ×
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = tagInput.trim().toLowerCase();
                if (!t) return;
                void patch({ tags: Array.from(new Set([...(pipeline?.tags ?? []), t])) });
                setTagInput("");
              }}
            >
              <input className="input" placeholder="Add tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
              <button className="btn-ghost" type="submit">Add</button>
            </form>
          </div>
        </>
      ) : (
        <div className="text-sm">
          {pipeline ? <>Stage: <span className="font-medium">{stageLabel(pipeline.stage)}</span></> : "—"}
          <p className="mt-1 text-xs text-ink-faint">Viewer role is read-only.</p>
        </div>
      )}
      {pipeline?.rejectionReason && (
        <p className="mt-3 border-t border-hairline pt-2 text-xs text-ink-soft">
          <span className="eyebrow text-deal-red">Passed:</span> {pipeline.rejectionReason}
        </p>
      )}
    </section>
  );
}
