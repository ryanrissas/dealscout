"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-ghost px-2.5 py-1 text-xs text-deal-red"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Delete this saved search?")) return;
        setBusy(true);
        await fetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
