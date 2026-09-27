import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/require-permission";
import { resolveAudience, atanmisUserIdleri, type AtamaSegment } from "@/lib/akademi/atama-audience";
import { previewHesap } from "@/lib/akademi/atama-model";

// POST - Yeni Atama önizlemesi: "N kişi atanacak · M zaten atanmış (atlanır)".
export async function POST(request: NextRequest) {
  const { error } = await requirePermission("akademi.admin");
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const courseId: string | undefined = body.courseId;
  const segment: AtamaSegment = body.segment ?? {};
  if (!courseId) {
    return NextResponse.json({ error: "courseId zorunlu" }, { status: 400 });
  }

  const audience = await resolveAudience(segment);
  const atanmis = await atanmisUserIdleri(courseId);
  const { atanacak, zatenAtanmis } = previewHesap(audience, atanmis);

  return NextResponse.json({
    hedefToplam: new Set(audience).size,
    atanacak,
    zatenAtanmis,
  });
}
