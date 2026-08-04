import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { KursiyerGorevDurum } from "@/generated/prisma";
import { NextResponse } from "next/server";

// IFS-4/IFS-DURUM: Kullanıcı GOREV görev durumunu işaretler.
// Tek doğruluk kaynağı ContentProgress.completed'tir; IfsTaskEvaluation.ornekYapildi
// (rapor + progress mirror) ve kursiyerDurum onu takip eder.
//
// Durumlar (birbirini dışlar):
//   ORNEK_YAPILDI   → completed=true  (örnek yaptı; açıklama zorunlu)
//   FARKLI_DEPARTMAN→ completed=false (görev bu kişiye ait değil → kurs paydasından düşer; açıklama zorunlu)
//   EGITIM_GEREKLI  → completed=false (eğitim talep etti; açıklama zorunlu)
//   BEKLIYOR        → completed=false (geri al; açıklama gerekmez, mevcut ornekAciklama SAKLANIR)

// Açıklama zorunlu olan durumlar
const ACIKLAMA_ZORUNLU: KursiyerGorevDurum[] = [
  KursiyerGorevDurum.ORNEK_YAPILDI,
  KursiyerGorevDurum.FARKLI_DEPARTMAN,
  KursiyerGorevDurum.EGITIM_GEREKLI,
];

function resolveDurum(body: { durum?: unknown; done?: unknown }): KursiyerGorevDurum | null {
  // Yeni client: durum. Geriye uyum: eski client { done } gönderiyor.
  if (typeof body.durum === "string") {
    const d = body.durum as KursiyerGorevDurum;
    return (Object.values(KursiyerGorevDurum) as string[]).includes(d) ? d : null;
  }
  // Eski akış: done=true → ORNEK_YAPILDI, done=false → BEKLIYOR (undefined → true)
  const done = body.done === undefined ? true : Boolean(body.done);
  return done ? KursiyerGorevDurum.ORNEK_YAPILDI : KursiyerGorevDurum.BEKLIYOR;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    durum?: unknown;
    done?: unknown;
    aciklama?: unknown;
  };

  const durum = resolveDurum(body);
  if (!durum) {
    return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
  }
  const done = durum === KursiyerGorevDurum.ORNEK_YAPILDI;

  const aciklama =
    typeof body.aciklama === "string" ? body.aciklama.trim() : "";
  if (ACIKLAMA_ZORUNLU.includes(durum) && !aciklama) {
    const mesaj =
      durum === KursiyerGorevDurum.FARKLI_DEPARTMAN
        ? "Lütfen neden farklı departman olduğunu açıklayın."
        : durum === KursiyerGorevDurum.EGITIM_GEREKLI
        ? "Lütfen hangi konuda eğitim gerektiğini açıklayın."
        : "Lütfen ne yaptığınızı kısaca açıklayın.";
    return NextResponse.json({ error: mesaj }, { status: 400 });
  }

  const content = await prisma.content.findFirst({
    where: { id, isActive: true },
    select: { id: true, courseId: true, type: true },
  });
  if (!content) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  }
  if (content.type !== "GOREV") {
    return NextResponse.json(
      { error: "Bu içerik bir görev değil" },
      { status: 400 }
    );
  }

  // GUARD: kullanıcı yalnız KENDİNE ATANMIŞ görevi işaretleyebilir (DEĞİŞMEDİ).
  const assigned = await prisma.userCourseAssignment.findFirst({
    where: { userId, assignment: { courseId: content.courseId } },
    select: { id: true },
  });
  if (!assigned) {
    return NextResponse.json(
      { error: "Bu görev size atanmamış" },
      { status: 403 }
    );
  }

  const existing = await prisma.contentProgress.findUnique({
    where: { userId_contentId: { userId, contentId: content.id } },
    select: { completedAt: true },
  });

  // Açıklama yalnız zorunlu durumlarda yazılır; BEKLIYOR'da mevcut açıklama SAKLANIR.
  const aciklamaData = ACIKLAMA_ZORUNLU.includes(durum)
    ? { ornekAciklama: aciklama }
    : {};

  await prisma.$transaction(async (tx) => {
    await tx.ifsTaskEvaluation.upsert({
      where: { userId_contentId: { userId, contentId: content.id } },
      create: {
        userId,
        contentId: content.id,
        kursiyerDurum: durum,
        ornekYapildi: done,
        ...aciklamaData,
      },
      update: {
        kursiyerDurum: durum,
        ornekYapildi: done,
        ...aciklamaData,
      },
    });

    await tx.contentProgress.upsert({
      where: { userId_contentId: { userId, contentId: content.id } },
      create: {
        userId,
        contentId: content.id,
        completed: done,
        completedAt: done ? new Date() : null,
      },
      update: {
        completed: done,
        completedAt: done ? existing?.completedAt ?? new Date() : null,
      },
    });
  });

  const progress = await recomputeCourseProgress(userId, content.courseId);

  return NextResponse.json({
    success: true,
    durum,
    ornekYapildi: done,
    percentage: progress?.percentage ?? 0,
    isCompleted: !!progress?.completedAt,
  });
}
