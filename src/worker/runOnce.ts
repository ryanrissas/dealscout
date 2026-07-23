import "dotenv/config";
import { runIngestion } from "@/lib/ingestion/ingest";
import { prisma } from "@/lib/db";

/** One-shot ingestion run: npm run ingest */
async function main() {
  const market = await prisma.market.findFirst({ orderBy: { createdAt: "asc" } });
  const res = await runIngestion({
    city: market?.city ?? "Toledo",
    state: market?.state ?? "OH",
    marketId: market?.id ?? null,
  });
  console.log(JSON.stringify(res, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
