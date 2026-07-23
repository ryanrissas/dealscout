"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SaveSearchButton({ query }: { query: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function save() {
    const name = window.prompt("Name this saved search:");
    if (!name) return;
    setBusy(true);
    const filters = Object.fromEntries(new URLSearchParams(query).entries());
    delete (filters as Record<string, unknown>).view;
    await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filters }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button onClick={save} disabled={busy} className="btn-ghost">
      {busy ? "Saving…" : "Save this search"}
    </button>
  );
}
