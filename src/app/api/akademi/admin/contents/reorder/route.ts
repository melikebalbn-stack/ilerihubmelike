import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { error } = await requirePermission('akademi.kurs.edit');
  if (error) return error;

  let body: { contentIds: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.contentIds) || body.contentIds.length === 0) {
    return NextResponse.json(
      { error: "contentIds dizisi gerekli" },
      { status: 400 }
    );
  }

  const ids = Array.from(new Set(body.contentIds.filter(Boolean)));
  if (ids.length !== body.contentIds.length) {
    return NextResponse.json(
      { error: "Aynı ID birden fazla kez gönderildi" },
      { status: 400 }
    );
  }

  const contents = await prisma.content.findMany({
    where: { id: { in: ids } },
    select: { id: true, courseId: true },
  });

  if (contents.length !== ids.length) {
    return NextResponse.json(
      { error: "Bazı içerikler bulunamadı" },
      { status: 404 }
    );
  }

  const courseIds = new Set(contents.map((c) => c.courseId));
  if (courseIds.size > 1) {
    return NextResponse.json(
      { error: "Sadece aynı kursun içerikleri sıralanabilir" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.content.update({
        where: { id },
        data: { order: index },
      })
    )
  );

  return NextResponse.json({
    message: "Sıralama güncellendi",
    count: ids.length,
  });
}
