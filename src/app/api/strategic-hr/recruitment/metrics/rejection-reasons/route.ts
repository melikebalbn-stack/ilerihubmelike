import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

// GET — Ret Nedenleri analizi: REJECTED başvurularda neden-başına sayı + kategori kırılımı.
// Kaynak: PublicJobApplication (gerçek akış) + RejectionReason. JobApplication OKUNMAZ.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin } = recruitAccess(session);
  // YALNIZ ADMIN (recruitment.view YETMEZ). Gerekçe: bu uç şirket geneli YÖNETİM
  // metriği döndürür ve kapsam daraltması TEKNİK OLARAK MÜMKÜN DEĞİL — başvuruda
  // departman ekseni yok (PublicJobApplication'da departman alanı ve JobOpening bağı
  // yok, JobOpening tablosu boş, requestedPosition serbest metin). UI'da Analiz/Tanımlar
  // sekmesi zaten `recruitment.admin`'e gizli; bu değişiklik kapı ile API'yi eşitler.
  if (!isAdmin) {
    return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
  }

  // REJECTED + ret nedeni bağlı olanlar.
  const gruplar = await prisma.publicJobApplication.groupBy({
    by: ["rejectionReasonId"],
    where: { status: "REJECTED", rejectionReasonId: { not: null } },
    _count: { _all: true },
  });

  const toplamRet = await prisma.publicJobApplication.count({ where: { status: "REJECTED" } });
  const nedenler = await prisma.rejectionReason.findMany({
    where: { id: { in: gruplar.map((g) => g.rejectionReasonId!).filter(Boolean) } },
    select: { id: true, name: true, category: true },
  });
  const nedenById = new Map(nedenler.map((n) => [n.id, n]));

  // Neden bazlı satırlar
  const satirlar = gruplar
    .map((g) => {
      const n = nedenById.get(g.rejectionReasonId!);
      return { name: n?.name ?? "—", category: n?.category ?? "—", count: g._count._all };
    })
    .sort((a, b) => b.count - a.count);

  // Kategori kırılımı
  const katMap = new Map<string, number>();
  for (const s of satirlar) katMap.set(s.category, (katMap.get(s.category) ?? 0) + s.count);
  const kategoriler = [...katMap.entries()].map(([category, count]) => ({ category, count }));

  return NextResponse.json({
    toplamRet, // REJECTED toplam (nedeni girilmemiş eskiler dahil)
    nedenliRet: satirlar.reduce((a, b) => a + b.count, 0),
    satirlar,
    kategoriler,
  });
}
