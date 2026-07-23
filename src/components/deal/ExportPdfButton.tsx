"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

interface PdfPayload {
  address: string;
  price: number | null;
  score: number | null;
  color: string | null;
  confidence: string | null;
  rentBasis: string | null;
  metrics: Array<{ label: string; value: string }>;
  facts: Array<[string, string]>;
  classificationReason: string;
  flags: string[];
  agent: { name: string; brokerage: string; phone: string | null; email: string | null } | null;
  source: string;
}

export default function ExportPdfButton({ payload }: { payload: PdfPayload }) {
  const [busy, setBusy] = useState(false);
  async function exportPdf() {
    setBusy(true);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold").setFontSize(16).text("DealScout — Deal Summary", 14, 16);
    doc.setFont("helvetica", "normal").setFontSize(11).text(payload.address, 14, 24);
    doc.setFontSize(9).setTextColor(110).text(
      `Price ${payload.price != null ? `$${payload.price.toLocaleString()}` : "Unknown"} · Score ${payload.score ?? "—"} (${payload.color ?? "unscored"}) · Confidence ${payload.confidence ?? "—"} · Rent basis ${payload.rentBasis ?? "—"} · ${payload.source}`,
      14, 30
    );
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 36,
      head: [["Metric", "Value"]],
      body: payload.metrics.map((m) => [m.label, m.value]),
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [39, 74, 109] },
    });
    autoTable(doc, {
      head: [["Fact", "Value"]],
      body: payload.facts,
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [25, 28, 34] },
    });
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(9);
    doc.text(`Classification: ${payload.classificationReason}`, 14, y, { maxWidth: 180 });
    if (payload.flags.length) doc.text(`Flags: ${payload.flags.join("; ")}`, 14, y + 8, { maxWidth: 180 });
    if (payload.agent) {
      doc.text(
        `Agent: ${payload.agent.name} — ${payload.agent.brokerage}${payload.agent.phone ? ` · ${payload.agent.phone}` : ""}${payload.agent.email ? ` · ${payload.agent.email}` : ""}`,
        14, y + 16, { maxWidth: 180 }
      );
    }
    doc.setFontSize(7.5).setTextColor(110).text(
      "Figures are estimates at stated assumptions. HUD FMR/SAFMR values are benchmarks — actual approved rents are set by the housing authority and are not guaranteed.",
      14, 287, { maxWidth: 180 }
    );
    doc.save("dealscout-summary.pdf");
    setBusy(false);
  }
  return (
    <button className="btn-ghost" onClick={exportPdf} disabled={busy}>
      <FileDown size={14} /> {busy ? "Building…" : "Export PDF"}
    </button>
  );
}
