"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function RunIngestionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/jobs/ingest", { method: "POST" });
    setBusy(false);
    if (!res.ok) { setResult("Ingestion failed — check server logs."); return; }
    const d = await res.json();
    setResult(`Fetched ${d.fetched} listings · ${d.newProperties} new · ${d.priceEvents} price events · ${d.alertsCreated} alerts.`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button className="btn-ghost" onClick={run} disabled={busy}>
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {busy ? "Running ingestion…" : "Run ingestion now"}
      </button>
      {result && <span className="text-xs text-ink-soft">{result}</span>}
    </div>
  );
}
