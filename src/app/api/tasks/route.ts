import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ propertyId: z.string().min(1), title: z.string().min(1).max(300), dueAt: z.string().datetime().optional() }),
  z.object({ id: z.string().min(1), toggle: z.literal(true) }),
]);

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if ("toggle" in parsed.data) {
    const t = await prisma.task.findUnique({ where: { id: parsed.data.id } });
    if (!t) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const updated = await prisma.task.update({
      where: { id: t.id },
      data: { status: t.status === "DONE" ? "OPEN" : "DONE" },
    });
    return NextResponse.json(updated);
  }
  const task = await prisma.task.create({
    data: {
      propertyId: parsed.data.propertyId,
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      assigneeId: user.id,
    },
  });
  return NextResponse.json(task);
}
