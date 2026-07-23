import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { fetchDeals } from "@/lib/dealQuery";
import { currentUser } from "@/lib/auth";
import { rentKindLabel, typeLabel, colorLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

const esc = (v: unknown): string => {
  if (v == null) return "Unknown";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const deals = await fetchDeals(parseFilters(params));

  const header = [
    "Street", "City", "State", "ZIP", "Type", "Units", "Year built", "Price", "Original price",
    "Status", "Days on market", "Rent basis", "Monthly rent", "Rent-to-price %", "Gross yield %",
    "NOI annual", "Cap rate %", "DSCR", "Cash flow monthly", "Cash flow annual", "Cash-on-cash %",
    "Cash to close", "Break-even occupancy %", "Price per unit", "Price per sqft",
    "Score", "Color", "Sec8 color", "HUD gross monthly", "Confidence", "Missing fields",
    "Source", "MLS number", "Listing URL", "Agent", "Agent phone", "Agent email", "Brokerage",
  ];

  const lines = deals.map((p) => {
    const m = p.metrics;
    const l = p.primary;
    return [
      p.street, p.city, p.state, p.zip, typeLabel(p.propertyType), p.unitCount, p.yearBuilt,
      l?.price, l?.originalPrice, l?.status, p.dom,
      m?.rentBasisUsed ? rentKindLabel(m.rentBasisUsed) : null, m?.monthlyGrossRent,
      m?.rentToPricePct, m?.grossYieldPct, m?.noiAnnual, m?.capRatePct, m?.dscr,
      m?.cashFlowMonthly, m?.cashFlowAnnual, m?.cocPct, m?.cashToClose, m?.breakEvenOccPct,
      m?.pricePerUnit, m?.pricePerSqft, m?.score, m?.color ? colorLabel(m.color) : null,
      m?.sec8Color ? colorLabel(m.sec8Color) : null, m?.hudMonthlyGross, m?.confidence,
      m?.missingFields?.join("; "), l?.source.name, l?.mlsNumber, l?.url,
      l?.agent?.fullName, l?.agent?.phone, l?.agent?.email, l?.agent?.brokerage,
    ].map(esc).join(",");
  });

  const csv = [header.join(","), ...lines].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dealscout-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
