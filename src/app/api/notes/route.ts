import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ propertyId: z.string().min(1), body: z.string().min(1).max(5000) });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const note = await prisma.note.create({
    data: { propertyId: parsed.data.propertyId, body: parsed.data.body, userId: user.id },
  });
  return NextResponse.json(note);
}
