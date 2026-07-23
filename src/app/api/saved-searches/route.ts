import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";
import { filterSchema } from "@/lib/filters";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const createSchema = z.object({ name: z.string().min(1).max(120), filters: z.record(z.unknown()) });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // Validate filters against the shared schema; strip anything unknown.
  const clean = filterSchema.safeParse(parsed.data.filters);
  if (!clean.success) return NextResponse.json({ error: "Invalid filters." }, { status: 400 });
  const { view: _view, ...filters } = clean.data;

  const search = await prisma.savedSearch.create({
    data: { name: parsed.data.name, filters: filters as Prisma.InputJsonValue, userId: user.id },
  });
  return NextResponse.json(search);
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const search = await prisma.savedSearch.findUnique({ where: { id } });
  if (!search) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (search.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the owner or an admin can delete this." }, { status: 403 });
  }
  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
