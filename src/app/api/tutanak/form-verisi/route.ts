// GET /api/tutanak/form-verisi
//
// Yeni tutanak formunun aday listeleri TEK çağrıda:
//   · personeller  → tutanak AÇILABİLECEĞİ kapsamdaki aktif personel
//                    (müdür/müdür yrd: kendi bölümü + alt ağacı; İV/platform: hepsi)
//   · sahitAdaylari → şahit olabilecek aktif personel (kapsam sınırı YOK; şahit
//                     başka bölümden de olabilir — kâğıt formda böyle)
//   · bolumler     → liste süzgeci için aktif bölümler
//
// Kapsam kararı tek kaynaktan (tutanakYetkisiCore); POST ayrıca doğrular.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { tutanakYetkisiCore, TUTANAK_ACMA_YETKISI_YOK } from '@/lib/tutanak/tutanak-yetki'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    if (!yetki.acabilir) {
      return NextResponse.json({ error: TUTANAK_ACMA_YETKISI_YOK }, { status: 403 })
    }

    // KAPSAM = açanın yetki kapsamındaki TÜM aktif personel. UNVAN AYRIMI YOK:
    // müdür / müdür yardımcısı / yönetici kadrosundakiler de listelenir (08.10.2026
    // ölçümü: koltuk sahibi 18 aktif personelin hepsi listede). Tek eleme kendisidir;
    // kişi kendi hakkında tutanak açamaz (POST ayrıca doğrular). Buraya unvan/kademe
    // süzgeci EKLENMEYECEK — İV'nin talebinde böyle bir kısıt yok.
    const kapsamAdlari = yetki.kapsamBolumler.map((b) => b.name)
    const personeller = await prisma.personnel.findMany({
      where: {
        aktif: true,
        ...(yetki.tumBolumler ? {} : { bolum: { in: kapsamAdlari } }),
        // Kendisi hakkında tutanak açılamaz (açan = hakkında olan saçma durumu).
        ...(yetki.personnelId ? { id: { not: yetki.personnelId } } : {}),
      },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true, gorev: true },
      orderBy: [{ bolum: 'asc' }, { adSoyad: 'asc' }],
    })

    const sahitAdaylari = await prisma.personnel.findMany({
      where: { aktif: true },
      select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      orderBy: [{ adSoyad: 'asc' }],
    })

    return NextResponse.json({
      personeller,
      sahitAdaylari,
      bolumler: yetki.kapsamBolumler,
      acanRol: yetki.acanRol,
      tumBolumler: yetki.tumBolumler,
    })
  } catch (err) {
    console.error('Tutanak form verisi hatası:', err)
    return NextResponse.json({ error: 'Form verisi yüklenemedi' }, { status: 500 })
  }
}
