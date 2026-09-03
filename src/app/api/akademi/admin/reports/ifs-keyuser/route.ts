import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAkademiUserId } from "@/lib/akademi-user";

// IFS KEY USER ATAMA YÖNETİMİ — GET / POST / DELETE.
// Yetki: akademi.admin (atama yapmak yönetim işi; değerlendirme yazma yetkisi
// AYRI bir izin — akademi.ifs.keyuser, bkz. ifs-keyuser-degerlendirme ucu).
//
// `bolum` serbest metin (Personnel.bolum değeri); DepartmentPackage.bolum ile
// aynı desen — bölümler ayrı tabloda tutulmuyor, FK yok.

const postSchema = z.object({
  bolum: z.string().trim().min(1),
  userId: z.string().trim().min(1),
});

export async function GET() {
  const { error } = await requirePermission(['ifs.admin', 'akademi.admin']);
  if (error) return error;

  const atamalar = await prisma.ifsKeyUser.findMany({
    orderBy: [{ bolum: "asc" }, { olusturmaTarihi: "asc" }],
    select: {
      id: true,
      bolum: true,
      userId: true,
      atayanId: true,
      olusturmaTarihi: true,
      user: { select: { name: true, email: true } },
    },
  });

  // Atayan adları — atayan kapsam dışı/silinmiş olabilir, ayrı tek sorgu.
  const atayanIds = [
    ...new Set(atamalar.map((a) => a.atayanId).filter(Boolean)),
  ] as string[];
  const atayanlar = atayanIds.length
    ? await prisma.user.findMany({
        where: { id: { in: atayanIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const atayanAd = new Map(
    atayanlar.map((u) => [u.id, u.name ?? u.email ?? u.id])
  );

  return NextResponse.json({
    atamalar: atamalar.map((a) => ({
      id: a.id,
      bolum: a.bolum,
      userId: a.userId,
      ad: a.user.name ?? a.user.email ?? a.userId,
      atayanAd: a.atayanId ? (atayanAd.get(a.atayanId) ?? null) : null,
      olusturmaTarihi: a.olusturmaTarihi.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission(['ifs.admin', 'akademi.admin']);
  if (error) return error;
  const actorId = await resolveAkademiUserId(session);
  if (!actorId) {
    return NextResponse.json(
      { error: "Kullanıcı çözümlenemedi" },
      { status: 401 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz girdi" },
      { status: 400 }
    );
  }
  const { bolum, userId } = parsed.data;

  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!kullanici) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  // Mükerrer: @@unique([bolum, userId]) zaten engelliyor; önce okuyup net mesaj
  // dönüyoruz ki UI 500 yerine 409 görsün.
  const mevcut = await prisma.ifsKeyUser.findUnique({
    where: { bolum_userId: { bolum, userId } },
    select: { id: true },
  });
  if (mevcut) {
    return NextResponse.json(
      { error: "Bu kişi zaten bu bölümün key user'ı." },
      { status: 409 }
    );
  }

  const olusan = await prisma.ifsKeyUser.create({
    data: { bolum, userId, atayanId: actorId },
    select: { id: true, bolum: true, userId: true },
  });
  return NextResponse.json(olusan, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requirePermission(['ifs.admin', 'akademi.admin']);
  if (error) return error;

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  }

  const mevcut = await prisma.ifsKeyUser.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) {
    return NextResponse.json({ error: "Atama bulunamadı" }, { status: 404 });
  }

  await prisma.ifsKeyUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
