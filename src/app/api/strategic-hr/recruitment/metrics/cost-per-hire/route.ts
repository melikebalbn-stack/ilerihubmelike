import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/require-session";

function recruitAccess(session: { user: { permissions?: string[] } }) {
  const perms = session.user.permissions ?? [];
  return { isAdmin: perms.includes("recruitment.admin"), canView: perms.includes("recruitment.view") };
}

// GET — İşe Alım Maliyeti: toplam maliyet · işe alınan (ACCEPTED) · kişi başı maliyet · kalem kırılımı.
// Kaynak: RecruitmentCost + PublicJobApplication (ACCEPTED). JobApplication OKUNMAZ.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const { isAdmin, canView } = recruitAccess(session);
  if (!isAdmin && !canView) return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });

  // Toplam maliyet + kalem bazlı kırılım
  const kayitlar = await prisma.recruitmentCost.findMany({
    select: { amount: true, publicJobApplicationId: true, item: { select: { name: true } } },
  });
  const toplamMaliyet = Math.round(kayitlar.reduce((a, k) => a + k.amount, 0) * 100) / 100;

  const kalemMap = new Map<string, number>();
  let basvuruBazli = 0;
  let genel = 0;
  for (const k of kayitlar) {
    kalemMap.set(k.item.name, (kalemMap.get(k.item.name) ?? 0) + k.amount);
    if (k.publicJobApplicationId) basvuruBazli += k.amount; else genel += k.amount;
  }
  const kalemler = [...kalemMap.entries()]
    .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  // İşe alınan = ACCEPTED sayısı
  const iseAlinan = await prisma.publicJobApplication.count({ where: { status: "ACCEPTED" } });

  // Cost-per-hire = toplam / işe alınan. ACCEPTED 0 → null (0'a bölme YOK → panel "-").
  const costPerHire = iseAlinan > 0 ? Math.round((toplamMaliyet / iseAlinan) * 100) / 100 : null;

  return NextResponse.json({
    toplamMaliyet,
    basvuruBazliMaliyet: Math.round(basvuruBazli * 100) / 100,
    genelMaliyet: Math.round(genel * 100) / 100,
    iseAlinan,
    costPerHire,
    kayitSayisi: kayitlar.length,
    kalemler,
  });
}
