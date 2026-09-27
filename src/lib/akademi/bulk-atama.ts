import { prisma } from "@/lib/prisma";
import { notifyAkademiEvent } from "@/lib/akademi-notify";
import { atanmisUserIdleri } from "./atama-audience";

/**
 * Toplu kurs ataması — container (CourseAssignment dueDate:null template) yeniden
 * kullanır, UserCourseAssignment.createMany({skipDuplicates}) ile yazar, YALNIZ
 * gerçekten yeni atananlara notifyAkademiEvent COURSE_ASSIGNED (push+mail+in-app).
 * Zaten atanmış kişiler atlanır (idempotent). 200+ kişide çağıran arka planda çalıştırır.
 */
export async function bulkAtama(
  courseId: string,
  userIds: string[],
  dueDate: Date | null
): Promise<{ atanan: number; atlanan: number }> {
  const uniq = [...new Set(userIds)];
  if (!uniq.length) return { atanan: 0, atlanan: 0 };

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) throw new Error("Kurs bulunamadı");

  const before = new Set(await atanmisUserIdleri(courseId));
  const yeniIds = uniq.filter((u) => !before.has(u));
  if (!yeniIds.length) return { atanan: 0, atlanan: uniq.length };

  // Container reuse: kurs başına tek dueDate:null template; kişi son tarihi satırda.
  let template = await prisma.courseAssignment.findFirst({
    where: { courseId, dueDate: null },
    select: { id: true },
  });
  if (!template) {
    template = await prisma.courseAssignment.create({
      data: { courseId, dueDate: null },
      select: { id: true },
    });
  }

  const res = await prisma.userCourseAssignment.createMany({
    data: yeniIds.map((userId) => ({ userId, assignmentId: template!.id, dueDate })),
    skipDuplicates: true,
  });

  // Bildirim yalnız yeni atananlara (fire-and-forget; publish/atama akışını bloklamaz).
  Promise.allSettled(
    yeniIds.map((userId) =>
      notifyAkademiEvent({
        userId,
        eventType: "COURSE_ASSIGNED",
        courseTitle: course.title,
        data: { deadline: dueDate },
        link: `/akademi/courses/${course.id}`,
      })
    )
  ).then((results) => {
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) console.error(`[bulk-atama] COURSE_ASSIGNED ${failed}/${results.length} başarısız`);
  });

  return { atanan: res.count, atlanan: uniq.length - res.count };
}
