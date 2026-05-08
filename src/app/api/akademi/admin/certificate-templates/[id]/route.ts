import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;
  const { id } = await params;

  const template = await prisma.akademiCertificateTemplate.findUnique({
    where: { id },
    include: { _count: { select: { certificates: true } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;
  const { id } = await params;

  const existing = await prisma.akademiCertificateTemplate.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const n = (body.name as string).toString().trim();
    if (n.length < 2) {
      return NextResponse.json(
        { error: "İsim en az 2 karakter olmalı" },
        { status: 400 }
      );
    }
    data.name = n;
  }
  if (body.description !== undefined) {
    data.description = body.description
      ? (body.description as string).toString().trim() || null
      : null;
  }
  if (body.content !== undefined) {
    data.content = body.content ? (body.content as string).toString() : "{}";
  }
  if (body.logoPath !== undefined) {
    data.logoPath = body.logoPath ? (body.logoPath as string) : null;
  }
  if (body.primaryColor !== undefined) {
    const pc = body.primaryColor as string;
    if (typeof pc === "string" && /^#[0-9a-fA-F]{6}$/.test(pc)) {
      data.primaryColor = pc;
    }
  }
  if (body.accentColor !== undefined) {
    const ac = body.accentColor as string;
    if (typeof ac === "string" && /^#[0-9a-fA-F]{6}$/.test(ac)) {
      data.accentColor = ac;
    }
  }
  if (body.defaultValidityMonths !== undefined) {
    const dvm =
      body.defaultValidityMonths === null ||
      body.defaultValidityMonths === ""
        ? null
        : Number(body.defaultValidityMonths);
    if (dvm !== null && (!Number.isInteger(dvm) || dvm < 1 || dvm > 120)) {
      return NextResponse.json(
        { error: "Geçerlilik 1-120 ay arası olmalı" },
        { status: 400 }
      );
    }
    data.defaultValidityMonths = dvm;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (body.isDefault === true && !existing.isDefault) {
      await tx.akademiCertificateTemplate.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
      data.isDefault = true;
    } else if (body.isDefault === false) {
      data.isDefault = false;
    }
    return tx.akademiCertificateTemplate.update({ where: { id }, data });
  });

  return NextResponse.json({ template: result });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('akademi.cert.manage');
  if (error) return error;
  const { id } = await params;

  const t = await prisma.akademiCertificateTemplate.findUnique({
    where: { id },
    include: { _count: { select: { certificates: true } } },
  });
  if (!t) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (t.isDefault) {
    return NextResponse.json(
      { error: "Varsayılan şablon silinemez" },
      { status: 400 }
    );
  }
  if (t._count.certificates > 0) {
    return NextResponse.json(
      {
        error: `${t._count.certificates} sertifikada kullanılıyor, silinemez`,
      },
      { status: 400 }
    );
  }
  await prisma.akademiCertificateTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
