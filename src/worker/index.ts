import "dotenv/config";
import cron from "node-cron";
import { runIngestion } from "@/lib/ingestion/ingest";
import { prisma } from "@/lib/db";

/**
 * Background worker. Runs the ingestion pipeline on a schedule
 * (INGEST_CRON, default every 30 minutes) against the default market.
 * Start with: npm run worker
 */

const schedule = process.env.INGEST_CRON ?? "*/30 * * * *";

async function tick() {
  const started = Date.now();
  try {
    const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
    const res = await runIngestion({
      city: market?.city ?? "Toledo",
      state: market?.state ?? "OH",
      marketId: market?.id ?? null,
    });
    console.log(
      `[worker] ${new Date().toISOString()} ingested in ${Date.now() - started}ms — ` +
        `fetched=${res.fetched} touched=${res.propertiesTouched} new=${res.newProperties} ` +
        `priceEvents=${res.priceEvents} alerts=${res.alertsCreated}` +
        (res.errors.length ? ` errors=${JSON.stringify(res.errors)}` : "")
    );
  } catch (err) {
    console.error("[worker] ingestion failed:", err);
  }
}

console.log(`[worker] starting — schedule "${schedule}"`);
void tick(); // run once at boot
cron.schedule(schedule, tick);
