import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET(_req: NextRequest) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;

  const templates = await prisma.akademiCertificateTemplate.findMany({
    include: { _count: { select: { certificates: true } } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const name = ((body.name ?? "") as string).toString().trim();
  if (name.length < 2) {
    return NextResponse.json(
      { error: "İsim en az 2 karakter olmalı" },
      { status: 400 }
    );
  }

  const isDefault = Boolean(body.isDefault);
  const description = body.description
    ? (body.description as string).toString().trim() || null
    : null;
  const content = body.content ? (body.content as string).toString() : "{}";
  const logoPath = body.logoPath ? (body.logoPath as string) : null;
  const primaryColor =
    typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
      ? body.primaryColor
      : "#0d2659";
  const accentColor =
    typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)
      ? body.accentColor
      : "#b38c26";
  const dvm =
    body.defaultValidityMonths !== null &&
    body.defaultValidityMonths !== undefined &&
    body.defaultValidityMonths !== ""
      ? Number(body.defaultValidityMonths)
      : null;
  if (dvm !== null && (!Number.isInteger(dvm) || dvm < 1 || dvm > 120)) {
    return NextResponse.json(
      { error: "Geçerlilik 1-120 ay arası olmalı" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.akademiCertificateTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.akademiCertificateTemplate.create({
      data: {
        name,
        description,
        content,
        logoPath,
        primaryColor,
        accentColor,
        defaultValidityMonths: dvm,
        isDefault,
      },
    });
  });

  return NextResponse.json({ template: result }, { status: 201 });
}
