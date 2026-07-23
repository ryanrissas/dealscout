import { colorLabel, rentKindLabel } from "@/lib/format";

const SPINE: Record<string, string> = {
  DARK_GREEN: "bg-deal-dark", GREEN: "bg-deal-green", YELLOW: "bg-deal-amber", RED: "bg-deal-red",
};
const WASH: Record<string, string> = {
  DARK_GREEN: "bg-deal-darkwash text-deal-dark border-deal-dark/25",
  GREEN: "bg-deal-greenwash text-deal-green border-deal-green/25",
  YELLOW: "bg-deal-amberwash text-deal-amber border-deal-amber/25",
  RED: "bg-deal-redwash text-deal-red border-deal-red/25",
};

export function spineClass(color: string | null | undefined): string {
  return SPINE[color ?? ""] ?? "bg-hairline";
}

export function ColorChip({ color, prefix }: { color: string | null | undefined; prefix?: string }) {
  if (!color) return <span className="eyebrow">Unscored</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${WASH[color]}`}>
      <span className={`h-2 w-2 rounded-[1px] ${SPINE[color]}`} />
      {prefix ? `${prefix} ` : ""}{colorLabel(color)}
    </span>
  );
}

export function ScoreChip({ score, color }: { score: number | null | undefined; color: string | null | undefined }) {
  return (
    <span className={`mono inline-flex min-w-[2.6rem] items-center justify-center rounded-sm px-1.5 py-0.5 text-sm font-bold text-white ${SPINE[color ?? ""] ?? "bg-ink-faint"}`}>
      {score ?? "—"}
    </span>
  );
}

export function ConfidenceChip({ confidence }: { confidence: string | null | undefined }) {
  if (!confidence) return null;
  const label = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence" }[confidence] ?? confidence;
  return <span className="eyebrow rounded-sm border border-hairline bg-white px-1.5 py-0.5">{label}</span>;
}

export function RentBasisChip({ kind }: { kind: string | null | undefined }) {
  const tone = kind === "ACTUAL" ? "border-deal-green/30 text-deal-green bg-deal-greenwash"
    : kind === "MARKET_ESTIMATE" ? "border-blue/30 text-blue bg-blue-wash"
    : kind === "PRO_FORMA" ? "border-deal-amber/30 text-deal-amber bg-deal-amberwash"
    : kind === "HUD_BENCHMARK" ? "border-blue/30 text-blue bg-blue-wash"
    : "border-hairline text-ink-faint bg-white";
  return (
    <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${tone}`}>
      {rentKindLabel(kind)}
    </span>
  );
}

export function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const tone = status === "ACTIVE" ? "text-deal-green border-deal-green/30 bg-deal-greenwash"
    : status === "PENDING" ? "text-deal-amber border-deal-amber/30 bg-deal-amberwash"
    : "text-ink-faint border-hairline bg-white";
  return <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] ${tone}`}>{status.replace("_", " ")}</span>;
}
