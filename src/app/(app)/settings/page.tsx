import { currentUser, isAdmin } from "@/lib/auth";
import { getAppSettings, resolveAssumptions } from "@/lib/settings";
import { allAdapters } from "@/lib/providers/registry";
import SettingsForm from "@/components/settings/SettingsForm";
import RunIngestionButton from "@/components/settings/RunIngestionButton";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  const admin = isAdmin(user?.role);
  const settings = await getAppSettings();
  const { assumptions, sources } = await resolveAssumptions({});
  const adapters = allAdapters().map((a) => ({
    key: a.key,
    name: a.name,
    kind: a.kind,
    priority: a.priority,
    configured: a.isConfigured(),
  }));

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow">Global configuration</div>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Assumptions resolve GLOBAL → MARKET → PROPERTY; this page edits the global scope
          (currently sourced from: {sources.join(" → ")}). Saving recomputes every deal.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold">Data sources</h2>
        <p className="mb-3 text-xs text-ink-faint">
          Listings come only from authorized feeds. Sample adapters generate clearly labeled demo
          data and are never presented as live listings. Lower priority number wins when the same
          property appears in multiple feeds.
        </p>
        <table className="w-full">
          <thead>
            <tr><th className="th">Source</th><th className="th">Kind</th><th className="th text-right">Priority</th><th className="th">Status</th></tr>
          </thead>
          <tbody>
            {adapters.map((a) => (
              <tr key={a.key}>
                <td className="td font-medium">{a.name} <span className="mono text-xs text-ink-faint">({a.key})</span></td>
                <td className="td text-xs">{a.kind === "mock" ? "Sample data" : a.kind === "mls_reso" ? "MLS / RESO Web API" : "Third-party API"}</td>
                <td className="td mono text-right">{a.priority}</td>
                <td className="td text-xs">
                  {a.configured
                    ? <span className="font-medium text-deal-green">Ready</span>
                    : <span className="text-ink-faint">Needs credentials — see docs/data-providers.md</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admin && (
          <div className="mt-4 border-t border-hairline pt-3">
            <RunIngestionButton />
          </div>
        )}
      </section>

      {admin ? (
        <SettingsForm settings={settings} assumptions={assumptions} />
      ) : (
        <section className="card p-5 text-sm text-ink-faint">
          Only admins can change assumptions, thresholds, and alert rules. Your role: {user?.role.toLowerCase()}.
        </section>
      )}
    </div>
  );
}
