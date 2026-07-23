import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";
import { filtersToQuery } from "@/lib/filters";
import { dateShort } from "@/lib/format";
import DeleteSearchButton from "@/components/deals/DeleteSearchButton";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const user = await currentUser();
  const searches = await prisma.savedSearch.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const editable = canEdit(user?.role);

  return (
    <div className="space-y-4">
      <header>
        <div className="eyebrow">Reusable deal screens</div>
        <h1 className="mt-1 text-3xl font-semibold">Saved searches</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Save a new one from the Deals page with "Save this search". Team presets have no owner.
        </p>
      </header>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Name</th>
              <th className="th">Criteria</th>
              <th className="th">Owner</th>
              <th className="th">Created</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {searches.map((s) => {
              const f = s.filters as Record<string, unknown>;
              const summary = Object.entries(f)
                .filter(([k]) => k !== "sort" && k !== "view")
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("|") : String(v)}`)
                .join(" · ") || "All deals";
              const mine = s.userId === user!.id;
              return (
                <tr key={s.id} className="hover:bg-paper">
                  <td className="td font-medium">{s.name}</td>
                  <td className="td max-w-md truncate text-xs text-ink-faint" title={summary}>{summary}</td>
                  <td className="td text-xs">{s.user?.name ?? "Team preset"}</td>
                  <td className="td text-xs text-ink-faint">{dateShort(s.createdAt)}</td>
                  <td className="td whitespace-nowrap text-right">
                    <Link href={`/deals?${filtersToQuery(f)}`} className="btn-primary mr-2 px-2.5 py-1 text-xs no-underline">Run</Link>
                    {editable && (mine || user!.role === "ADMIN") && <DeleteSearchButton id={s.id} />}
                  </td>
                </tr>
              );
            })}
            {searches.length === 0 && (
              <tr><td colSpan={5} className="td py-8 text-center text-ink-faint">No saved searches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
