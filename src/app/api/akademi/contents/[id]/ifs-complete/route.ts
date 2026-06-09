import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { recomputeCourseProgress } from "@/lib/akademi/course-progress";
import { NextResponse } from "next/server";

// IFS-4: Kullanıcı GOREV görevini "Örnek Yaptım" işaretler (veya geri alır).
// Tek doğruluk kaynağı ContentProgress'tir; IfsTaskEvaluation.ornekYapildi onu
// mirror'lar. contents/[id]/progress pattern'i reuse — ek olarak evaluation upsert
// ve ATAMA guard'ı. Diğer içerik tiplerinin tamamlama akışı (progress endpoint)
// bu endpoint'ten etkilenmez.
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

  const body = (await req.json().catch(() => ({}))) as { done?: unknown };
  const done = body.done === undefined ? true : Boolean(body.done);

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

  // GUARD: kullanıcı yalnız KENDİNE ATANMIŞ görevi işaretleyebilir.
  // (Kursa ait bir CourseAssignment'a UserCourseAssignment ile bağlıysa atanmış.)
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

  await prisma.$transaction(async (tx) => {
    // IFS-özel değerlendirme: ornekYapildi (diğer alanlar IFS-5'te eğitmence).
    await tx.ifsTaskEvaluation.upsert({
      where: { userId_contentId: { userId, contentId: content.id } },
      create: { userId, contentId: content.id, ornekYapildi: done },
      update: { ornekYapildi: done },
    });

    // Tek doğruluk kaynağı: ContentProgress.
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

  // Transaction dışında: kurs ilerlemesini yeniden hesapla → Departman Panosu yansır.
  const progress = await recomputeCourseProgress(userId, content.courseId);

  return NextResponse.json({
    success: true,
    ornekYapildi: done,
    percentage: progress?.percentage ?? 0,
    isCompleted: !!progress?.completedAt,
  });
}
