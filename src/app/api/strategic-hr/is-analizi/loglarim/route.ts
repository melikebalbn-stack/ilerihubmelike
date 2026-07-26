// GET /api/strategic-hr/is-analizi/loglarim
// Çalışanın KENDİ iş analizi formlarını listeler.
// Sadece "güncel" haller: başka bir kaydın oncekiVersiyonId'si olarak
// kullanılmamış (zincirin ucundaki) kayıtlar. Eski versiyonlar gizlenir.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iaRolCozumle } from "@/lib/is-analizi/ia-yetki";


export async function GET() {
  const { rol, error } = await iaRolCozumle();
  if (error) return error;

  const personnelId = rol.personnelId;
  if (!personnelId) {
    return NextResponse.json({ error: "Personel kaydınız bulunamadı." }, { status: 404 });
  }

  try {
    // Çalışanın tüm formları
    const hepsi = await prisma.iaIsAnalizi.findMany({
      where: { personelId: personnelId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        durum: true,
        versiyon: true,
        oncekiVersiyonId: true,
        amirNotu: true,
        amir: true,
        createdAt: true,
        pozisyon: { select: { ad: true } },
        _count: { select: { yapilanIsler: true, yetkinlikler: true } },
      },
    });

    // "Geçilmiş" versiyonları bul: başka kayıtta oncekiVersiyonId olarak geçenler
    const gecilmisIdler = new Set(
      hepsi.map((f) => f.oncekiVersiyonId).filter(Boolean) as string[]
    );

    // Güncel haller = geçilmemiş olanlar (zincir ucu)
    const guncel = hepsi.filter((f) => !gecilmisIdler.has(f.id));

    return NextResponse.json({ formlar: guncel });
  } catch (err) {
    console.error("[loglarim] hata:", err);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }
}
