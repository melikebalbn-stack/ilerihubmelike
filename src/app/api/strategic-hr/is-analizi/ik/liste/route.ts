// GET /api/strategic-hr/is-analizi/ik/liste
// İK incelemesindeki (IK_INCELEMESINDE) tüm formları listeler.
// Erişim: rol HR_MANAGER veya ADMIN/SUPER_ADMIN.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function GET() {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  if (!rol.ik) return iaYetkisiz();

  try {
    const formlar = await prisma.iaIsAnalizi.findMany({
      where: { durum: "IK_INCELEMESINDE" },
      orderBy: { amirOnayTarihi: "desc" },
      select: {
        id: true,
        adSoyad: true,
        sicilNo: true,
        bolum: true,
        yaka: true,
        versiyon: true,
        amir: true,
        amirPersonnelId: true, // null → güvensiz amir, doğrudan İK'ya gelmiş ("Amir atanamadı" rozeti)
        amirNotu: true,
        amirOnayTarihi: true,
        pozisyon: { select: { ad: true } },
        _count: {
          select: { yapilanIsler: true, yetkinlikler: true, kararYetkileri: true, isIliskileri: true },
        },
      },
    });
    return NextResponse.json({ formlar });
  } catch (err) {
    console.error("[ik/liste] hata:", err);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }
}
