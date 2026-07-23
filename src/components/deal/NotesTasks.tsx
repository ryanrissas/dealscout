"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NoteItem { id: string; body: string; author: string; createdAt: string }
interface TaskItem { id: string; title: string; status: string; assignee: string | null; dueAt: string | null }

export default function NotesTasks({
  propertyId, notes, tasks, editable,
}: { propertyId: string; notes: NoteItem[]; tasks: TaskItem[]; editable: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-4 space-y-5">
      <div>
        <div className="eyebrow mb-2">Notes</div>
        {editable && (
          <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) { void post("/api/notes", { propertyId, body: note.trim() }); setNote(""); } }} className="mb-3">
            <textarea className="input" rows={2} placeholder="Add a note for the team" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary mt-1.5" disabled={busy || !note.trim()}>Add note</button>
          </form>
        )}
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="border-b border-hairline pb-2 text-sm">
              <p className="leading-snug">{n.body}</p>
              <div className="mt-1 text-xs text-ink-faint">{n.author} · {new Date(n.createdAt).toLocaleDateString()}</div>
            </li>
          ))}
          {notes.length === 0 && <li className="text-sm text-ink-faint">No notes yet.</li>}
        </ul>
      </div>

      <div>
        <div className="eyebrow mb-2">Tasks</div>
        {editable && (
          <form onSubmit={(e) => { e.preventDefault(); if (task.trim()) { void post("/api/tasks", { propertyId, title: task.trim() }); setTask(""); } }} className="mb-3 flex gap-2">
            <input className="input" placeholder="New task" value={task} onChange={(e) => setTask(e.target.value)} />
            <button className="btn-ghost" disabled={busy || !task.trim()}>Add</button>
          </form>
        )}
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={t.status === "DONE"}
                disabled={!editable || busy}
                onChange={() => post("/api/tasks", { id: t.id, toggle: true })}
              />
              <span className={t.status === "DONE" ? "text-ink-faint line-through" : ""}>
                {t.title}
                {(t.assignee || t.dueAt) && (
                  <span className="block text-xs text-ink-faint">
                    {t.assignee ?? "Unassigned"}{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                  </span>
                )}
              </span>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-sm text-ink-faint">No tasks yet.</li>}
        </ul>
      </div>
    </section>
  );
}
