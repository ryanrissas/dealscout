import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { currentUser, canEdit } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canEdit(user.role)) return NextResponse.json({ error: "Viewer role is read-only." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const propertyId = form?.get("propertyId");
  const file = form?.get("file");
  if (typeof propertyId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "propertyId and file are required." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Files must be under 10 MB." }, { status: 413 });
  }
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
  const stored = `${crypto.randomBytes(8).toString("hex")}-${safeName}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.attachment.create({
    data: {
      propertyId,
      fileName: file.name,
      filePath: `/uploads/${stored}`,
      size: file.size,
      uploadedBy: user.name || user.email,
    },
  });
  return NextResponse.json(attachment);
}
