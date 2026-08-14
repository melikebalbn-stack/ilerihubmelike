import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assessmentGuard } from "@/lib/assessment/guard";

// GET — sınav detayı (soruları + şıkları ile)
//
// YALNIZ ADMIN (recruitment.view YETMEZ). Gerekçe: soru bankası SINAV BÜTÜNLÜĞÜ
// meselesidir — sorulari gören, adaya sınav öncesi verebilir. Müdürün soru görmeye
// ihtiyacı yok; adayının SONUCUNU görmesi yeterli ve o yol açık kalıyor
// (assessments/sessions?publicJobApplicationId= → atanan müdür yetkili).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;

  const sinav = await prisma.candidateAssessment.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: {
            orderBy: { order: "asc" },
            // isCorrect YALNIZ admin'de seçilir — view kullanıcısında alan hiç gelmez.
            // Şıklar `include` ile çekilirse Prisma TÜM sütunları döndürür ve `isCorrect`
            // sessizce yanıta girer — bu yüzden AÇIK `select` (aday ucundaki desenin aynısı,
            // bkz. api/public/sinav/[token]/route.ts). Guard artık admin-only olduğu için
            // koşul bugün hep doğru; SAVUNMA AMAÇLI duruyor — kapı ileride gevşetilirse
            // cevap anahtarı yine kendiliğinden dışarı çıkmaz.
            select: { id: true, text: true, order: true, ...(g.isAdmin ? { isCorrect: true } : {}) },
          },
        },
      },
      _count: { select: { sessions: true } },
    },
  });
  if (!sinav) return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  return NextResponse.json(sinav);
}

// PATCH — sınav tanımını güncelle (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name != null) data.name = String(body.name);
  if (body.type != null) data.type = body.type;
  if (body.durationMin != null) data.durationMin = Number(body.durationMin);
  if (body.passingScore != null) data.passingScore = Number(body.passingScore);
  if (body.isActive != null) data.isActive = Boolean(body.isActive);

  const sinav = await prisma.candidateAssessment.update({ where: { id }, data });
  return NextResponse.json(sinav);
}

// DELETE — sınav sil (admin). Atanmış oturum varsa engelle (veri kaybı olmasın).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await assessmentGuard({ requireAdmin: true });
  if (g.error) return g.error;
  const { id } = await params;

  const oturumSayisi = await prisma.assessmentSession.count({ where: { assessmentId: id } });
  if (oturumSayisi > 0) {
    return NextResponse.json(
      { error: "Bu sınav adaylara atanmış; silinemez. Önce pasife alın." },
      { status: 409 },
    );
  }
  // Sorular/şıklar Cascade ile silinir.
  await prisma.candidateAssessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
