import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";
import { resolveAssumptions } from "@/lib/settings";
import { money, pct, num, int, dateShort, daysOnMarket, typeLabel, rentKindLabel } from "@/lib/format";
import { ColorChip, ScoreChip, ConfidenceChip, RentBasisChip, StatusChip, spineClass } from "@/components/ui/chips";
import ScoreLedger, { type Breakdown } from "@/components/deal/ScoreLedger";
import Sec8Panel from "@/components/deal/Sec8Panel";
import AgentCard from "@/components/deal/AgentCard";
import PipelineControls from "@/components/deal/PipelineControls";
import NotesTasks from "@/components/deal/NotesTasks";
import Attachments from "@/components/deal/Attachments";
import UnderwritingPanel from "@/components/deal/UnderwritingPanel";
import ExportPdfButton from "@/components/deal/ExportPdfButton";
import type { Sec8Analysis } from "@/lib/scoring/section8";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  const p = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      metrics: true,
      units: { orderBy: { label: "asc" } },
      rentRecords: { orderBy: { createdAt: "desc" } },
      pipeline: true,
      notes: { include: { user: true }, orderBy: { createdAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "desc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { occurredAt: "desc" }, take: 30 },
      scenarios: { orderBy: { updatedAt: "desc" } },
      listings: {
        include: { source: true, agent: true, priceEvents: { orderBy: { occurredAt: "desc" } } },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });
  if (!p) notFound();

  const primary = p.listings.find((l) => l.isPrimary) ?? p.listings[0] ?? null;
  const m = p.metrics;
  const breakdown = (m?.breakdown ?? null) as Breakdown | null;
  const sec8 = (m?.sec8 ?? null) as Sec8Analysis | null;
  const dom = daysOnMarket(primary?.listDate ?? null);
  const editable = canEdit(user?.role);
  const { assumptions } = await resolveAssumptions({ marketId: p.marketId, propertyId: p.id });

  const rentsByKind: Array<{ kind: string; amount: number | null }> = ["ACTUAL", "MARKET_ESTIMATE", "PRO_FORMA"].map((k) => ({
    kind: k,
    amount: breakdown?.rentsByKind?.[k as "ACTUAL"] ?? null,
  }));

  const metricCells: Array<{ label: string; value: string; strong?: boolean; danger?: boolean }> = [
    { label: "Rent-to-price /mo", value: pct(m?.rentToPricePct), strong: true },
    { label: "Gross yield /yr", value: pct(m?.grossYieldPct, 1) },
    { label: "Cash flow /mo", value: money(m?.cashFlowMonthly), strong: true, danger: (m?.cashFlowMonthly ?? 0) < 0 },
    { label: "Cash flow /yr", value: money(m?.cashFlowAnnual), danger: (m?.cashFlowAnnual ?? 0) < 0 },
    { label: "DSCR", value: num(m?.dscr) },
    { label: "Cap rate", value: pct(m?.capRatePct) },
    { label: "Cash-on-cash", value: pct(m?.cocPct) },
    { label: "NOI /yr", value: money(m?.noiAnnual) },
    { label: "Cash to close", value: money(m?.cashToClose) },
    { label: "Break-even occupancy", value: pct(m?.breakEvenOccPct, 1) },
    { label: "Price / unit", value: money(m?.pricePerUnit) },
    { label: "Price / sqft", value: m?.pricePerSqft != null ? money(m.pricePerSqft, true) : "Unknown" },
  ];

  const facts: Array<[string, string]> = [
    ["Property type", `${typeLabel(p.propertyType)} · ${int(p.unitCount)} unit${p.unitCount > 1 ? "s" : ""}`],
    ["Year built", p.yearBuilt != null ? String(p.yearBuilt) : "Unknown"],
    ["Building sqft", p.buildingSqft != null ? int(p.buildingSqft) : "Unknown"],
    ["Lot sqft", p.lotSqft != null ? int(p.lotSqft) : "Unknown"],
    ["Occupancy", p.occupancy.replace("_", " ").toLowerCase()],
    ["Taxes (annual)", p.taxesAnnual != null ? money(p.taxesAnnual) : "Unknown"],
    ["Assessed value", p.taxAssessedValue != null ? money(p.taxAssessedValue) : "Unknown"],
    ["Owner-paid utilities", p.ownerPaidUtilities ?? "Unknown"],
    ["Owner utilities /mo", p.ownerUtilitiesMonthly != null ? money(p.ownerUtilitiesMonthly) : "Unknown"],
    ["Parking", p.parking ?? "Unknown"],
    ["Heating", p.heating ?? "Unknown"],
    ["Cooling", p.cooling ?? "Unknown"],
    ["Roof", p.roof ?? "Unknown"],
    ["Foundation", p.foundation ?? "Unknown"],
    ["Flood zone", p.floodZone ?? "Unknown"],
    ["Estimated rehab", p.estimatedRehab != null ? money(p.estimatedRehab) : "None reported"],
  ];

  const pdfPayload = {
    address: `${p.street}, ${p.city}, ${p.state} ${p.zip}`,
    price: primary?.price ?? null,
    score: m?.score ?? null,
    color: m?.color ?? null,
    confidence: m?.confidence ?? null,
    rentBasis: m?.rentBasisUsed ?? null,
    metrics: metricCells,
    facts,
    classificationReason: breakdown?.classificationReason ?? "",
    flags: breakdown?.flags ?? [],
    agent: primary?.agent
      ? { name: primary.agent.fullName, brokerage: primary.agent.brokerage, phone: primary.agent.phone, email: primary.agent.email }
      : null,
    source: primary ? `${primary.source.name}${primary.mlsNumber ? ` · ${primary.mlsNumber}` : ""}` : "",
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="card relative overflow-hidden">
        <span className={`absolute inset-y-0 left-0 w-1 ${spineClass(m?.color)}`} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 pl-6">
          <div className="min-w-0">
            <div className="eyebrow"><Link href="/deals" className="text-ink-faint no-underline hover:text-blue">Deals</Link> / {p.city}</div>
            <h1 className="mt-1 text-3xl font-semibold leading-tight">{p.street}</h1>
            <div className="mt-1 text-sm text-ink-faint">{p.city}, {p.state} {p.zip}{p.county ? ` · ${p.county} County` : ""}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ColorChip color={m?.color} />
              {m?.sec8Color && <ColorChip color={m.sec8Color} prefix="§8" />}
              <ConfidenceChip confidence={m?.confidence} />
              <RentBasisChip kind={m?.rentBasisUsed} />
              <StatusChip status={primary?.status} />
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-3xl font-bold">{money(primary?.price ?? null)}</div>
            {primary?.originalPrice != null && primary.price < primary.originalPrice && (
              <div className="mono text-sm text-deal-green">reduced from {money(primary.originalPrice)}</div>
            )}
            <div className="mt-1 text-xs text-ink-faint">
              {primary ? <>Source: {primary.source.name}{primary.mlsNumber ? ` · ${primary.mlsNumber}` : ""}</> : "No listing on file"}
              {dom != null && <> · {dom} days on market</>}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <ExportPdfButton payload={pdfPayload} />
              {primary?.url && (
                <a href={primary.url} target="_blank" rel="noreferrer" className="btn-ghost no-underline">Listing page ↗</a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-hairline px-6 py-2.5">
          <span className="eyebrow">Score</span>
          <ScoreChip score={m?.score} color={m?.color} />
          <span className="text-sm text-ink-soft">{breakdown?.classificationReason}</span>
        </div>
      </header>

      {p.photos.length > 0 && (
        <div className="flex gap-3 overflow-x-auto">
          {p.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1} of ${p.street}`} className="h-44 rounded-sm border border-hairline object-cover" />
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[8fr_4fr]">
        <div className="min-w-0 space-y-6">
          {/* ── Key metrics ─────────────────────────────────────────────────── */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Underwriting at current assumptions</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
              {metricCells.map((c) => (
                <div key={c.label}>
                  <div className="eyebrow">{c.label}</div>
                  <div className={`mono mt-0.5 ${c.strong ? "text-xl font-bold" : "text-base"} ${c.danger ? "text-deal-red" : ""} ${c.value === "Unknown" ? "text-ink-faint text-sm" : ""}`}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>
            {(m?.missingFields?.length ?? 0) > 0 && (
              <p className="mt-4 border-t border-hairline pt-3 text-xs text-ink-faint">
                Missing information reduces confidence: {m!.missingFields.join(", ")}. Unknown values are never treated as zero.
              </p>
            )}
          </section>

          {/* ── Rent records ────────────────────────────────────────────────── */}
          <section className="card p-5">
            <h2 className="mb-1 text-lg font-semibold">Rent by provenance</h2>
            <p className="mb-3 text-xs text-ink-faint">
              The underwriting basis is chosen in trust order — actual, then market estimate, then pro forma — and is always shown. Nothing is silently substituted.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {rentsByKind.map((r) => (
                <div key={r.kind} className={`rounded-sm border p-3 ${m?.rentBasisUsed === r.kind ? "border-blue bg-blue-wash" : "border-hairline bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <RentBasisChip kind={r.kind} />
                    {m?.rentBasisUsed === r.kind && <span className="eyebrow text-blue">Basis</span>}
                  </div>
                  <div className="mono mt-2 text-xl font-bold">{r.amount != null ? money(r.amount) : "Unknown"}</div>
                  <div className="text-xs text-ink-faint">per month, all units</div>
                </div>
              ))}
            </div>
            {p.rentRecords.length > 0 && (
              <table className="mt-4 w-full">
                <thead><tr><th className="th">Kind</th><th className="th text-right">Amount /mo</th><th className="th">Source</th><th className="th">Note</th></tr></thead>
                <tbody>
                  {p.rentRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="td">{rentKindLabel(r.kind)}</td>
                      <td className="td mono text-right">{money(r.monthlyAmount)}</td>
                      <td className="td text-xs">{r.source ?? "—"}</td>
                      <td className="td text-xs text-ink-faint">{r.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Units ───────────────────────────────────────────────────────── */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Unit mix</h2>
            {p.units.length === 0 ? (
              <p className="text-sm text-ink-faint">Unit mix unknown — per-unit HUD benchmarks can't be applied until bedrooms are confirmed.</p>
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">Unit</th><th className="th text-right">Beds</th><th className="th text-right">Baths</th><th className="th text-right">Sqft</th><th className="th text-right">Actual rent</th><th className="th">Occupied</th></tr></thead>
                <tbody>
                  {p.units.map((u) => (
                    <tr key={u.id}>
                      <td className="td font-medium">{u.label}</td>
                      <td className="td mono text-right">{u.bedrooms}</td>
                      <td className="td mono text-right">{u.bathrooms}</td>
                      <td className="td mono text-right">{u.sqft != null ? int(u.sqft) : "—"}</td>
                      <td className="td mono text-right">{u.currentRent != null ? money(u.currentRent) : "Unknown"}</td>
                      <td className="td text-xs">{u.occupied == null ? "Unknown" : u.occupied ? "Yes" : "Vacant"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Section 8 / HUD panel ───────────────────────────────────────── */}
          <Sec8Panel sec8={sec8} />

          {/* ── Score ledger ───────────────────────────────────────────────── */}
          <ScoreLedger breakdown={breakdown} score={m?.score ?? null} color={m?.color ?? null} />

          {/* ── Custom underwriting ─────────────────────────────────────────── */}
          <UnderwritingPanel
            propertyId={p.id}
            editable={editable}
            price={primary?.price ?? 0}
            unitCount={p.unitCount}
            buildingSqft={p.buildingSqft}
            taxesAnnualKnown={p.taxesAnnual}
            ownerUtilitiesMonthlyKnown={p.ownerUtilitiesMonthly}
            estimatedRehab={p.estimatedRehab}
            rentOptions={rentsByKind.filter((r) => r.amount != null) as Array<{ kind: string; amount: number }>}
            defaultBasis={m?.rentBasisUsed ?? null}
            assumptions={assumptions}
            scenarios={p.scenarios.map((s) => ({ id: s.id, name: s.name, rentBasis: s.rentBasis, createdAt: s.createdAt.toISOString() }))}
          />

          {/* ── Description & facts ─────────────────────────────────────────── */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Listing facts</h2>
            {p.description && <p className="mb-4 text-sm leading-relaxed text-ink-soft">{p.description}</p>}
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hairline py-1.5 text-sm">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className={`text-right font-medium ${v === "Unknown" ? "text-ink-faint font-normal" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
            {(p.codeViolations || p.conditionNotes) && (
              <div className="mt-4 rounded-sm border border-deal-red/30 bg-deal-redwash p-3 text-sm">
                <div className="eyebrow mb-1 text-deal-red">Flags</div>
                {p.codeViolations && <p><span className="font-medium">Code violations:</span> {p.codeViolations}</p>}
                {p.conditionNotes && <p><span className="font-medium">Condition:</span> {p.conditionNotes}</p>}
              </div>
            )}
          </section>

          {/* ── History ─────────────────────────────────────────────────────── */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-semibold">Price & status history</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="eyebrow mb-2">Price events</div>
                <ul className="space-y-1.5">
                  {(primary?.priceEvents ?? []).map((e) => (
                    <li key={e.id} className="flex justify-between border-b border-hairline pb-1.5 text-sm">
                      <span className="text-ink-faint">{dateShort(e.occurredAt)}</span>
                      <span className="mono font-medium">{money(e.price)}</span>
                    </li>
                  ))}
                  {(primary?.priceEvents ?? []).length === 0 && <li className="text-sm text-ink-faint">No price changes recorded.</li>}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-2">Change log</div>
                <ul className="space-y-1.5">
                  {p.statusHistory.map((h) => (
                    <li key={h.id} className="border-b border-hairline pb-1.5 text-sm">
                      <span className="text-ink-faint">{dateShort(h.occurredAt)}</span>{" "}
                      <span className="mono text-xs">{h.field}</span>: {h.oldValue ?? "—"} → <span className="font-medium">{h.newValue ?? "—"}</span>
                    </li>
                  ))}
                  {p.statusHistory.length === 0 && <li className="text-sm text-ink-faint">No changes recorded yet.</li>}
                </ul>
              </div>
            </div>
          </section>

          {/* ── All listings (dedupe transparency) ──────────────────────────── */}
          {p.listings.length > 1 && (
            <section className="card p-5">
              <h2 className="mb-1 text-lg font-semibold">Listings across sources</h2>
              <p className="mb-3 text-xs text-ink-faint">This property appears in multiple feeds. The primary record comes from the most authoritative, freshest source; every link is preserved.</p>
              <table className="w-full">
                <thead><tr><th className="th">Source</th><th className="th">MLS #</th><th className="th text-right">Price</th><th className="th">Status</th><th className="th">Updated</th><th className="th">Primary</th></tr></thead>
                <tbody>
                  {p.listings.map((l) => (
                    <tr key={l.id}>
                      <td className="td">{l.source.name}</td>
                      <td className="td mono text-xs">{l.mlsNumber ?? "—"}</td>
                      <td className="td mono text-right">{money(l.price)}</td>
                      <td className="td"><StatusChip status={l.status} /></td>
                      <td className="td text-xs">{dateShort(l.sourceUpdatedAt)}</td>
                      <td className="td text-xs">{l.isPrimary ? <span className="font-medium text-blue">Primary</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="space-y-6">
          <AgentCard
            agent={primary?.agent ? {
              fullName: primary.agent.fullName,
              brokerage: primary.agent.brokerage,
              phone: primary.agent.phone,
              email: primary.agent.email,
              officePhone: primary.agent.officePhone,
              mlsAgentId: primary.agent.mlsAgentId,
              sourceUpdatedAt: primary.agent.sourceUpdatedAt?.toISOString() ?? null,
            } : null}
            sourceName={primary?.source.name ?? null}
          />
          <PipelineControls
            propertyId={p.id}
            editable={editable}
            pipeline={p.pipeline ? {
              stage: p.pipeline.stage,
              favorite: p.pipeline.favorite,
              tags: p.pipeline.tags,
              rejectionReason: p.pipeline.rejectionReason,
            } : null}
          />
          <NotesTasks
            propertyId={p.id}
            editable={editable}
            notes={p.notes.map((n) => ({ id: n.id, body: n.body, author: n.user.name, createdAt: n.createdAt.toISOString() }))}
            tasks={p.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee?.name ?? null, dueAt: t.dueAt?.toISOString() ?? null }))}
          />
          <Attachments
            propertyId={p.id}
            editable={editable}
            files={p.attachments.map((a) => ({ id: a.id, fileName: a.fileName, filePath: a.filePath, size: a.size, createdAt: a.createdAt.toISOString() }))}
          />
        </div>
      </div>
    </div>
  );
}
