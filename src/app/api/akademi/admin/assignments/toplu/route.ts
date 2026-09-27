import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/require-permission";
import { parseDueDateEndOfDay } from "@/lib/akademi/due-date";
import { notifyAkademiEvent } from "@/lib/akademi-notify";

// POST - Kurs detayında seçili atamalar üzerinde toplu işlem:
//  action=sure-uzat (dueDate güncelle) | kaldir (sil) | hatirlat (DEADLINE_APPROACHING).
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const action: string = body.action;
  const ids: string[] = Array.isArray(body.userAssignmentIds) ? body.userAssignmentIds : [];
  if (!ids.length) return NextResponse.json({ error: "Seçili atama yok" }, { status: 400 });

  if (action === "sure-uzat") {
    const { dueDate } = parseDueDateEndOfDay(body.dueDate);
    const res = await prisma.userCourseAssignment.updateMany({
      where: { id: { in: ids } },
      data: { dueDate },
    });
    return NextResponse.json({ guncellenen: res.count, message: `${res.count} atamanın son tarihi güncellendi` });
  }

  if (action === "kaldir") {
    const res = await prisma.userCourseAssignment.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ silinen: res.count, message: `${res.count} atama kaldırıldı` });
  }

  if (action === "hatirlat") {
    const rows = await prisma.userCourseAssignment.findMany({
      where: { id: { in: ids } },
      select: {
        userId: true,
        dueDate: true,
        assignment: { select: { course: { select: { id: true, title: true } } } },
      },
    });
    Promise.allSettled(
      rows.map((r) =>
        notifyAkademiEvent({
          userId: r.userId,
          eventType: "DEADLINE_APPROACHING",
          courseTitle: r.assignment.course.title,
          data: { deadline: r.dueDate },
          link: `/akademi/courses/${r.assignment.course.id}`,
        })
      )
    ).then((results) => {
      const failed = results.filter((x) => x.status === "rejected").length;
      if (failed > 0) console.error(`[toplu-hatirlat] ${failed}/${results.length} başarısız`);
    });
    return NextResponse.json({ hatirlatilan: rows.length, message: `${rows.length} kişiye hatırlatma gönderildi` });
  }

  return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
}
