import { NextRequest, NextResponse } from "next/server";
import { getAppSettings, saveAppSettings, saveGlobalAssumptions } from "@/lib/settings";
import { recomputeAllMetrics } from "@/lib/metrics";
import { currentUser, isAdmin } from "@/lib/auth";
import type { AppSettings } from "@/lib/scoring/thresholds";
import type { UnderwriteAssumptions } from "@/lib/finance/underwriting";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await getAppSettings());
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!isAdmin(user?.role)) return NextResponse.json({ error: "Admin role required." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { settings?: AppSettings; assumptions?: UnderwriteAssumptions }
    | null;
  if (!body?.settings || !body?.assumptions) {
    return NextResponse.json({ error: "settings and assumptions are required." }, { status: 400 });
  }

  await saveAppSettings(body.settings);
  await saveGlobalAssumptions({ financing: body.assumptions.financing, opex: body.assumptions.opex });
  const recomputed = await recomputeAllMetrics();
  return NextResponse.json({ ok: true, recomputed });
}
