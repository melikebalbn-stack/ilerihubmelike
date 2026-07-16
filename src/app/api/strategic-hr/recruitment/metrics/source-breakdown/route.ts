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

// Boş/null referralSource için grup anahtarı (İK veri eksikliğini görsün diye gizlenmez).
const BELIRTILMEMIS = "BELIRTILMEMIS";

// GET — Kaynak Kırılımı: GERÇEK başvuru akışı = PublicJobApplication.referralSource
// (enum: AGENCY/ISKUR/WEBSITE/REFERENCE/OTHER + null). Her kaynak için:
// başvuru sayısı · işe alınan (status=ACCEPTED) · dönüşüm %.
// JobApplication/Candidate OKUNMAZ (ölü tablo, 3 test kaydı). Sandbox tabloları okunmaz.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const { isAdmin, canViewByDept } = recruitAccess(session);
  if (!isAdmin && !canViewByDept) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  const basvurular = await prisma.publicJobApplication.findMany({
    select: {
      referralSource: true,
      status: true,
    },
  });

  // Kaynak-başına başvuru + işe alınan (ACCEPTED). null → "Belirtilmemiş".
  const acc = new Map<string, { basvuru: number; iseAlinan: number }>();
  for (const b of basvurular) {
    const kaynak = b.referralSource ?? BELIRTILMEMIS;
    let a = acc.get(kaynak);
    if (!a) { a = { basvuru: 0, iseAlinan: 0 }; acc.set(kaynak, a); }
    a.basvuru++;
    if (b.status === "ACCEPTED") a.iseAlinan++;
  }

  const kaynaklar = [...acc.entries()]
    .map(([source, a]) => ({
      source,
      basvuru: a.basvuru,
      iseAlinan: a.iseAlinan,
      // dönüşüm oranı (%) — 0'a bölme yok (basvuru>0 garanti).
      donusumOrani: Math.round((a.iseAlinan / a.basvuru) * 1000) / 10,
    }))
    // "Belirtilmemiş" en sona; gerisi başvuru sayısına göre azalan.
    .sort((x, y) => {
      if (x.source === BELIRTILMEMIS) return 1;
      if (y.source === BELIRTILMEMIS) return -1;
      return y.basvuru - x.basvuru;
    });

  return NextResponse.json({ kaynaklar });
}
