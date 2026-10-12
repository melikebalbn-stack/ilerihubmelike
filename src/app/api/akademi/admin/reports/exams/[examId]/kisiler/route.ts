import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import {
  kisiDurumListesi,
  type SinavKisiDurum,
} from "@/lib/akademi/sinav-kpi";
import { AKTIF_PERSONEL } from "@/lib/user-personnel";

const GECERLI_DURUMLAR: SinavKisiDurum[] = [
  "GECTI",
  "KALDI",
  "DEVAM",
  "BASLAMADI",
];

/**
 * Sınav KPI kartına / tablo hücresine tıklayınca açılan kişi listesi.
 * Sayılarla aynı kaynaktan (kisiDurumListesi) üretilir ki liste ile kart
 * birbirini tutsun.
 *
 * ?durum=BASLAMADI → yalnız o durumdakiler; parametresiz → hepsi.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { error } = await requirePermission("akademi.report.view");
  if (error) return error;

  const { examId } = await params;
  const istenenDurum = req.nextUrl.searchParams.get("durum");
  if (istenenDurum && !GECERLI_DURUMLAR.includes(istenenDurum as SinavKisiDurum)) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      courseId: true,
      attempts: {
        select: { userId: true, status: true, passed: true, score: true },
      },
    },
  });
  if (!exam) {
    return NextResponse.json({ error: "Sınav bulunamadı" }, { status: 404 });
  }

  const atananlar = exam.courseId
    ? (
        await prisma.userCourseAssignment.findMany({
          where: { assignment: { courseId: exam.courseId } },
          select: { userId: true },
        })
      ).map((a) => a.userId)
    : [];

  let satirlar = kisiDurumListesi(atananlar, exam.attempts);
  if (istenenDurum) {
    satirlar = satirlar.filter((s) => s.durum === istenenDurum);
  }
  if (satirlar.length === 0) {
    return NextResponse.json({ exam: { id: exam.id, title: exam.title }, kisiler: [] });
  }

  // İsim/bölüm tek sorguda. Ayrılan personel zaten atama listesinde
  // görünmemeli; yine de burada da süzülür (personel kaydı olmayan
  // hesaplar etkilenmez).
  const kullanicilar = await prisma.user.findMany({
    where: {
      id: { in: satirlar.map((s) => s.userId) },
      OR: [{ personnelId: null }, { personnel: { is: AKTIF_PERSONEL } }],
    },
    select: {
      id: true,
      name: true,
      email: true,
      personnel: { select: { bolum: true, sicilNo: true } },
    },
  });
  const bilgi = new Map(kullanicilar.map((u) => [u.id, u]));

  const kisiler = satirlar
    .filter((s) => bilgi.has(s.userId))
    .map((s) => {
      const u = bilgi.get(s.userId)!;
      return {
        userId: s.userId,
        ad: u.name ?? u.email ?? s.userId,
        email: u.email,
        sicilNo: u.personnel?.sicilNo ?? null,
        bolum: u.personnel?.bolum ?? null,
        durum: s.durum,
        puan: s.sonPuan,
      };
    })
    .sort((a, b) => a.ad.localeCompare(b.ad, "tr"));

  return NextResponse.json({
    exam: { id: exam.id, title: exam.title },
    durum: istenenDurum ?? null,
    kisiler,
  });
}
