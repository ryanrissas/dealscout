import type { RentKind } from "@/generated/prisma/enums";

export interface RentByKind {
  ACTUAL?: number | null;
  PRO_FORMA?: number | null;
  MARKET_ESTIMATE?: number | null;
  HUD_BENCHMARK?: number | null;
}

/**
 * Default underwriting basis, by trust: ACTUAL in-place rent, then a
 * MARKET_ESTIMATE, then seller PRO_FORMA. HUD benchmarks are never used as
 * the default basis — they appear only in explicit HUD scenarios.
 * The chosen basis is always stored and displayed; nothing is silently
 * substituted.
 */
export function selectRentBasis(rents: RentByKind): { kind: RentKind; amount: number } | null {
  const order: RentKind[] = ["ACTUAL", "MARKET_ESTIMATE", "PRO_FORMA"];
  for (const kind of order) {
    const v = rents[kind as keyof RentByKind];
    if (v != null && v > 0) return { kind, amount: v };
  }
  return null;
}
