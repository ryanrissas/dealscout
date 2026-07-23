import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestion/ingest";
import { currentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Triggered by the worker/cron (Bearer CRON_SECRET) or an admin in the UI. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const viaCron = Boolean(secret && auth === `Bearer ${secret}`);
  if (!viaCron) {
    const user = await currentUser();
    if (!isAdmin(user?.role)) {
      return NextResponse.json({ error: "Admin or cron secret required." }, { status: 401 });
    }
  }
  const result = await runIngestion();
  return NextResponse.json(result);
}
