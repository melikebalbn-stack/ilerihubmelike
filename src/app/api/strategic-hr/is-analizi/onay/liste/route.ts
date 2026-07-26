// GET /api/strategic-hr/is-analizi/onay/liste
// Amirin onayındaki iş analizi formlarını listeler.
// Amir kimliği: login → User.personnelId. Sorgu: amirPersonnelId = o id.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle, iaYetkisiz } from "@/lib/is-analizi/ia-yetki";


export async function GET() {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;
  if (!rol.amir) return iaYetkisiz();

  const personnelId = rol.personnelId;
  if (!personnelId) {
    return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
  }

  try {
    const formlar = await prisma.iaIsAnalizi.findMany({
      where: {
        amirPersonnelId: personnelId,
        durum: "AMIR_ONAYINDA",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        adSoyad: true,
        sicilNo: true,
        bolum: true,
        yaka: true,
        durum: true,
        createdAt: true,
        pozisyon: { select: { ad: true } },
        _count: {
          select: {
            yapilanIsler: true,
            yetkinlikler: true,
            kararYetkileri: true,
            isIliskileri: true,
          },
        },
      },
    });

    return NextResponse.json({ formlar });
  } catch (err) {
    console.error("[onay/liste] hata:", err);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }
}
