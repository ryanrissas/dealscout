import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { HUD_FMR_SEED, UTILITY_ALLOWANCE_SEED } from "../src/lib/hud/fmrData";
import { DEFAULT_SETTINGS } from "../src/lib/scoring/thresholds";
import { runIngestion } from "../src/lib/ingestion/ingest";

/**
 * Seed script — safe to re-run (idempotent upserts).
 *
 *  1. Team + demo users (admin / member / viewer, password "Password123!")
 *  2. Toledo market + global settings row
 *  3. HUD FMR/SAFMR records + SAMPLE utility allowances
 *  4. Full ingestion of the mock sources (properties, listings, metrics, alerts)
 *  5. Six seeded saved searches
 *  6. Sample pipeline items, notes and tasks so the workspace feels lived-in
 */

async function main() {
  console.log("── DealScout seed ──");

  // 1) Team + users
  const team = await prisma.team.upsert({
    where: { id: "seed-team" },
    create: { id: "seed-team", name: "Acquisitions Team" },
    update: {},
  });

  const password = await bcrypt.hash("Password123!", 10);
  const mkUser = (email: string, name: string, role: "ADMIN" | "MEMBER" | "VIEWER") =>
    prisma.user.upsert({
      where: { email },
      create: { email, name, role, passwordHash: password, teamId: team.id },
      update: { role, teamId: team.id },
    });

  const admin = await mkUser("admin@example.com", "Avery Admin", "ADMIN");
  const member = await mkUser("member@example.com", "Morgan Member", "MEMBER");
  await mkUser("viewer@example.com", "Vic Viewer", "VIEWER");
  console.log("users ready: admin@example.com / member@example.com / viewer@example.com (Password123!)");

  // 2) Market + settings
  const market = await prisma.market.upsert({
    where: { id: "seed-market-toledo" },
    create: {
      id: "seed-market-toledo",
      name: "Toledo, OH",
      city: "Toledo",
      county: "Lucas",
      state: "OH",
      notes:
        "Default market. High rent-to-price ratios east and north of downtown; strong Section 8 demand (Lucas Metropolitan Housing).",
    },
    update: {},
  });

  await prisma.appSetting.upsert({
    where: { id: "global" },
    create: { id: "global", data: DEFAULT_SETTINGS as unknown as object },
    update: {},
  });

  // 3) HUD data
  for (const r of HUD_FMR_SEED) {
    const existing = await prisma.hudFmrRecord.findFirst({
      where: { fiscalYear: r.fiscalYear, zip: r.zip ?? null, isSafmr: r.isSafmr, areaName: r.areaName },
    });
    const data = {
      fiscalYear: r.fiscalYear,
      areaName: r.areaName,
      areaCode: r.areaCode ?? null,
      state: r.state,
      county: r.county ?? null,
      zip: r.zip ?? null,
      isSafmr: r.isSafmr,
      efficiency: r.efficiency,
      oneBr: r.oneBr,
      twoBr: r.twoBr,
      threeBr: r.threeBr,
      fourBr: r.fourBr,
      effectiveDate: new Date(r.effectiveDate),
      sourceUrl: r.sourceUrl,
      note: r.note ?? null,
    };
    if (existing) await prisma.hudFmrRecord.update({ where: { id: existing.id }, data });
    else await prisma.hudFmrRecord.create({ data });
  }
  console.log(`HUD FMR records: ${HUD_FMR_SEED.length}`);

  for (const u of UTILITY_ALLOWANCE_SEED) {
    const existing = await prisma.utilityAllowance.findFirst({
      where: { authorityName: u.authorityName, bedrooms: u.bedrooms },
    });
    const data = {
      authorityName: u.authorityName,
      state: u.state,
      zip: u.zip,
      bedrooms: u.bedrooms,
      monthlyAmount: u.monthlyAmount,
      tenantPaid: u.tenantPaid,
      note: u.note,
      effectiveDate: u.effectiveDate ? new Date(u.effectiveDate) : null,
    };
    if (existing) await prisma.utilityAllowance.update({ where: { id: existing.id }, data });
    else await prisma.utilityAllowance.create({ data });
  }
  console.log("utility allowances seeded (SAMPLE schedule)");

  // 4) Ingest mock sources
  const run = await runIngestion({ city: "Toledo", state: "OH", marketId: market.id });
  console.log(
    `ingestion: fetched=${run.fetched} properties=${run.propertiesTouched} new=${run.newProperties} priceEvents=${run.priceEvents} alerts=${run.alertsCreated}` +
      (run.errors.length ? ` errors=${JSON.stringify(run.errors)}` : "")
  );

  // 5) Saved searches
  const searches: Array<{ name: string; filters: object }> = [
    {
      name: "Toledo Exceptional Deals",
      filters: { city: "Toledo", colors: ["DARK_GREEN"], sort: "score-desc" },
    },
    {
      name: "Ohio 2% Rule",
      filters: { state: "OH", minRatioPct: 2.0, sort: "ratio-desc" },
    },
    {
      name: "1950+ Multifamily",
      filters: {
        minYearBuilt: 1950,
        propertyTypes: ["DUPLEX", "TRIPLEX", "FOURPLEX", "MULTI_5_20", "MULTI_20_PLUS"],
        sort: "ratio-desc",
      },
    },
    { name: "5–20 Units", filters: { propertyTypes: ["MULTI_5_20"], sort: "price-asc" } },
    { name: "20+ Units", filters: { propertyTypes: ["MULTI_20_PLUS"], sort: "price-asc" } },
    { name: "Recent Price Drops", filters: { hasPriceDrop: true, sort: "updated-desc" } },
  ];
  for (const s of searches) {
    const existing = await prisma.savedSearch.findFirst({ where: { name: s.name, userId: null } });
    if (!existing) {
      await prisma.savedSearch.create({ data: { name: s.name, filters: s.filters, userId: null } });
    }
  }
  console.log(`saved searches: ${searches.length}`);

  // 6) Sample pipeline activity
  const utah = await prisma.property.findFirst({ where: { street: { contains: "1247 Utah" } } });
  const colburn = await prisma.property.findFirst({ where: { street: { contains: "857 Colburn" } } });
  const lagrange = await prisma.property.findFirst({ where: { street: { contains: "3126 Lagrange" } } });
  const whiteford = await prisma.property.findFirst({ where: { street: { contains: "5644 Whiteford" } } });

  if (utah) {
    await prisma.pipelineItem.upsert({
      where: { propertyId: utah.id },
      create: {
        propertyId: utah.id,
        stage: "UNDERWRITING",
        assigneeId: member.id,
        tags: ["east-side", "priority"],
        favorite: true,
      },
      update: {},
    });
    const hasNote = await prisma.note.findFirst({ where: { propertyId: utah.id } });
    if (!hasNote) {
      await prisma.note.create({
        data: {
          propertyId: utah.id,
          userId: admin.id,
          body: "Rents are ~$75/unit under the ZIP SAFMR benchmark. Ask listing agent for lease copies and last 12 months of water bills before offering.",
        },
      });
      await prisma.task.create({
        data: {
          propertyId: utah.id,
          title: "Request leases + utility history from Marcus Bell",
          assigneeId: member.id,
          dueAt: new Date(Date.now() + 3 * 86_400_000),
        },
      });
    }
  }
  if (colburn) {
    await prisma.pipelineItem.upsert({
      where: { propertyId: colburn.id },
      create: {
        propertyId: colburn.id,
        stage: "CONTACT_AGENT",
        assigneeId: member.id,
        tags: ["section-8"],
        favorite: true,
      },
      update: {},
    });
    const hasNote = await prisma.note.findFirst({ where: { propertyId: colburn.id } });
    if (!hasNote) {
      await prisma.note.create({
        data: {
          propertyId: colburn.id,
          userId: member.id,
          body: "Section 8 angle: 3BR SAFMR minus sample utility allowance suggests ~$1,220 contract rent vs $995 actual (+22%). Confirm allowances with Lucas Metropolitan Housing before underwriting the uplift.",
        },
      });
    }
  }
  if (lagrange) {
    await prisma.pipelineItem.upsert({
      where: { propertyId: lagrange.id },
      create: { propertyId: lagrange.id, stage: "REVIEWING", tags: ["four-plex"] },
      update: {},
    });
  }
  if (whiteford) {
    await prisma.pipelineItem.upsert({
      where: { propertyId: whiteford.id },
      create: {
        propertyId: whiteford.id,
        stage: "PASSED",
        rejectionReason: "0.76% rent-to-price ratio — cannot reach positive cash flow at defaults even with 30% down.",
      },
      update: {},
    });
  }
  console.log("pipeline samples ready");

  console.log("── seed complete ──");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
