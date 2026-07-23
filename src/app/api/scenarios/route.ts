import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const schema = z.object({
  propertyId: z.string().min(1),
  name: z.string().min(1).max(120),
  rentBasis: z.enum(["ACTUAL", "PRO_FORMA", "MARKET_ESTIMATE", "HUD_BENCHMARK"]),
  assumptions: z.record(z.unknown()),
  results: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const s = await prisma.underwritingScenario.create({
    data: {
      propertyId: parsed.data.propertyId,
      userId: user.id,
      name: parsed.data.name,
      rentBasis: parsed.data.rentBasis,
      assumptions: parsed.data.assumptions as Prisma.InputJsonValue,
      results: (parsed.data.results ?? {}) as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json(s);
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.underwritingScenario.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
