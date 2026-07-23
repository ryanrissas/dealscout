import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ all: z.literal(true) }),
]);

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if ("all" in parsed.data) {
    const r = await prisma.alert.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return NextResponse.json({ updated: r.count });
  }
  const r = await prisma.alert.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: { read: true },
  });
  return NextResponse.json({ updated: r.count });
}
