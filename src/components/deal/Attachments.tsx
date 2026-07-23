"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";

interface FileItem { id: string; fileName: string; filePath: string; size: number; createdAt: string }

export default function Attachments({
  propertyId, files, editable,
}: { propertyId: string; files: FileItem[]; editable: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("file", file);
    const res = await fetch("/api/attachments", { method: "POST", body: fd });
    if (!res.ok) setError("Upload failed — files must be under 10 MB.");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-4">
      <div className="eyebrow mb-2">Attachments</div>
      {editable && (
        <>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <button className="btn-ghost mb-3" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Paperclip size={14} /> {busy ? "Uploading…" : "Upload file"}
          </button>
          {error && <p className="mb-2 text-xs text-deal-red">{error}</p>}
        </>
      )}
      <ul className="space-y-1.5">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
            <a href={f.filePath} target="_blank" rel="noreferrer" className="truncate text-blue">{f.fileName}</a>
            <span className="mono shrink-0 text-xs text-ink-faint">{(f.size / 1024).toFixed(0)} KB</span>
          </li>
        ))}
        {files.length === 0 && <li className="text-sm text-ink-faint">Nothing attached — leases, inspection reports, and rent rolls live here.</li>}
      </ul>
    </section>
  );
}
