import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

// Recruitment modülünün mevcut yetki deseni (recruitAccess) — yeni izin icat edilmez.
function recruitAccess(session: {
  user: { permissions?: string[]; department?: string | null; email?: string | null };
}) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewByDept: perms.includes("recruitment.view"),
  };
}

// GET — Kaynak Kırılımı: her başvuru kaynağı (Candidate.source) için
// başvuru sayısı + işe başlayan (startDate dolu) + dönüşüm oranı.
// Yalnız main verisi: JobApplication + Candidate.source. Maliyet YOK (ayrı katman).
// Sandbox tabloları okunmaz.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const { isAdmin, canViewByDept } = recruitAccess(session);
  if (!isAdmin && !canViewByDept) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  const basvurular = await prisma.jobApplication.findMany({
    select: {
      startDate: true,
      candidate: { select: { source: true } },
    },
  });

  // Kaynak-başına başvuru + işe başlayan.
  const acc = new Map<string, { basvuru: number; iseBaslayan: number }>();
  for (const b of basvurular) {
    const kaynak = b.candidate?.source;
    if (!kaynak) continue;
    let a = acc.get(kaynak);
    if (!a) { a = { basvuru: 0, iseBaslayan: 0 }; acc.set(kaynak, a); }
    a.basvuru++;
    if (b.startDate) a.iseBaslayan++;
  }

  const kaynaklar = [...acc.entries()]
    .map(([source, a]) => ({
      source,
      basvuru: a.basvuru,
      iseBaslayan: a.iseBaslayan,
      // dönüşüm oranı (%) — 0'a bölme yok (basvuru>0 garanti).
      donusumOrani: Math.round((a.iseBaslayan / a.basvuru) * 1000) / 10,
    }))
    .sort((x, y) => y.basvuru - x.basvuru);

  return NextResponse.json({ kaynaklar });
}
