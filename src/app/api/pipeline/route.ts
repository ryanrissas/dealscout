import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  propertyId: z.string().min(1),
  stage: z.enum(["NEW", "REVIEWING", "CONTACT_AGENT", "UNDERWRITING", "OFFER_PLANNED", "OFFER_SUBMITTED", "UNDER_CONTRACT", "PASSED", "CLOSED"]).optional(),
  favorite: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  rejectionReason: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { propertyId, stage, favorite, tags, rejectionReason } = parsed.data;

  if (stage === "PASSED" && (!rejectionReason || rejectionReason.trim().length < 5)) {
    return NextResponse.json({ error: "Passing a deal requires a reason (5+ characters)." }, { status: 400 });
  }

  const existing = await prisma.pipelineItem.findUnique({ where: { propertyId } });
  const item = await prisma.pipelineItem.upsert({
    where: { propertyId },
    create: {
      propertyId,
      stage: stage ?? "NEW",
      favorite: favorite ?? false,
      tags: tags ?? [],
      rejectionReason: stage === "PASSED" ? rejectionReason?.trim() : null,
    },
    update: {
      ...(stage ? { stage } : {}),
      ...(favorite !== undefined ? { favorite } : {}),
      ...(tags ? { tags } : {}),
      ...(stage === "PASSED" ? { rejectionReason: rejectionReason?.trim() } : {}),
      ...(stage && stage !== "PASSED" && existing?.stage === "PASSED" ? { rejectionReason: null } : {}),
      ...(stage && existing?.stage !== stage ? { stageChangedAt: new Date() } : {}),
    },
  });

  if (stage && existing?.stage !== stage) {
    await prisma.propertyStatusHistory.create({
      data: {
        propertyId,
        field: "pipeline.stage",
        oldValue: existing?.stage ?? null,
        newValue: stage,
      },
    });
  }
  return NextResponse.json(item);
}
