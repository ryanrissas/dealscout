"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AlertActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost shrink-0 px-2 py-1 text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
        router.refresh();
      }}
    >
      Mark read
    </button>
  );
}

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
        setBusy(false);
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
