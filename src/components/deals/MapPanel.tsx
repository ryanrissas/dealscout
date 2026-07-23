"use client";

import dynamic from "next/dynamic";
import type { MapDeal } from "./DealMap";

const DealMap = dynamic(() => import("./DealMap"), {
  ssr: false,
  loading: () => <div className="card flex h-[540px] items-center justify-center text-sm text-ink-faint">Loading map…</div>,
});

// Serialize only what the map needs (server → client boundary).
export default function MapPanel({ deals }: { deals: Array<Record<string, unknown>> }) {
  const points: MapDeal[] = deals
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => {
      const metrics = p.metrics as { color?: string; score?: number; rentToPricePct?: number | null; cashFlowMonthly?: number | null } | null;
      const primary = p.primary as { price?: number } | null;
      return {
        id: String(p.id),
        street: String(p.street),
        city: String(p.city),
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        color: metrics?.color ?? null,
        score: metrics?.score ?? null,
        ratio: metrics?.rentToPricePct ?? null,
        cf: metrics?.cashFlowMonthly ?? null,
        price: primary?.price ?? null,
      };
    });
  return <DealMap points={points} />;
}
