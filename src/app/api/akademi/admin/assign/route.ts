import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAudience, type AtamaSegment } from "@/lib/akademi/atama-audience";
import { bulkAtama } from "@/lib/akademi/bulk-atama";
import { parseDueDateEndOfDay } from "@/lib/akademi/due-date";

// POST - Hedef kitle segmentine toplu kurs ataması (container reuse + skipDuplicates
// + notifyAkademiEvent COURSE_ASSIGNED). Zaten atanmışlar atlanır.
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const courseId: string | undefined = body.courseId;
  const segment: AtamaSegment = body.segment ?? {};
  if (!courseId) {
    return NextResponse.json({ error: "courseId zorunlu" }, { status: 400 });
  }

  const { dueDate } = parseDueDateEndOfDay(body.dueDate);

  const userIds = await resolveAudience(segment);
  if (!userIds.length) {
    return NextResponse.json({ atanan: 0, atlanan: 0, message: "Hedef kitlede kişi yok" });
  }

  const { atanan, atlanan } = await bulkAtama(courseId, userIds, dueDate);
  return NextResponse.json({
    atanan,
    atlanan,
    message: atanan > 0
      ? `${atanan} kişiye atandı${atlanan > 0 ? `, ${atlanan} zaten atanmıştı (atlandı)` : ""}`
      : "Yeni atama yok (hepsi zaten atanmış)",
  });
}
