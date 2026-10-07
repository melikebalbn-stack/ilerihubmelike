// GET  /api/tutanak        — görünürlük kapsamındaki tutanaklar (liste/KPI)
// POST /api/tutanak        — yeni tutanak (TASLAK ya da doğrudan gönderilmiş)
//
// Kapsam ve kapılar tek kaynaktan: lib/tutanak/tutanak-yetki.ts.
// Hakkında tutanak tutulan personel kapsam dışıdır (tutanakListeWhere).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import {
  TUTANAK_ACMA_YETKISI_YOK,
  TUTANAK_ERISIM_YOK,
  tutanakListeWhere,
  tutanakYetkisiCore,
} from '@/lib/tutanak/tutanak-yetki'
import { yeniTutanakNo } from '@/lib/tutanak/tutanak-no'
import { kademeBul, sonYoneticiSec, secilebilirBasamaklar, yoneticiZinciri } from '@/lib/tutanak/tutanak-yoneticiler'
import { tutanakAksiyonUygula } from '@/lib/tutanak/tutanak-akis'
import type { TutanakSebep } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const SEBEPLER: TutanakSebep[] = ['ISG_KURALLARINA_UYMAMA', 'DISIPLIN', 'HATALI_ISLEM_URETIM', 'DEVAMSIZLIK']

export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir && !yetki.platformBypass) {
      return NextResponse.json({ error: TUTANAK_ERISIM_YOK }, { status: 403 })
    }

    const tutanaklar = await prisma.tutanak.findMany({
      where: tutanakListeWhere(yetki),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tutanakNo: true,
        tutanakTarihi: true,
        adSoyadSnapshot: true,
        sicilSnapshot: true,
        bolumSnapshot: true,
        gorevSnapshot: true,
        sebep: true,
        durum: true,
        createdAt: true,
        yonetici: { select: { adSoyad: true } },
        acan: { select: { name: true, email: true } },
        sahitler: { select: { durum: true } },
      },
    })

    const satirlar = tutanaklar.map((t) => ({
      id: t.id,
      tutanakNo: t.tutanakNo,
      tutanakTarihi: t.tutanakTarihi,
      adSoyadSnapshot: t.adSoyadSnapshot,
      sicilSnapshot: t.sicilSnapshot,
      bolumSnapshot: t.bolumSnapshot,
      gorevSnapshot: t.gorevSnapshot,
      sebep: t.sebep,
      durum: t.durum,
      yoneticiAd: t.yonetici?.adSoyad ?? null,
      sahitSayisi: t.sahitler.length,
      onaylayanSahitSayisi: t.sahitler.filter((s) => s.durum === 'ONAYLADI').length,
      acanAd: t.acan?.name ?? t.acan?.email ?? null,
      createdAt: t.createdAt,
    }))

    return NextResponse.json({ satirlar, iv: yetki.iv, acabilir: yetki.acabilir })
  } catch (err) {
    console.error('Tutanak listesi hatası:', err)
    return NextResponse.json({ error: 'Tutanak listesi alınamadı' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    if (!yetki.acabilir || !yetki.acanRol) {
      return NextResponse.json({ error: TUTANAK_ACMA_YETKISI_YOK }, { status: 403 })
    }

    const body = await request.json()
    const personnelId = typeof body.personnelId === 'string' ? body.personnelId.trim() : ''
    const sebep = body.sebep as TutanakSebep
    const aciklama = typeof body.aciklama === 'string' ? body.aciklama.trim() : ''
    const yoneticiId = typeof body.yoneticiId === 'string' ? body.yoneticiId.trim() : ''
    const sahitIdler: string[] = Array.isArray(body.sahitIdler)
      ? [
          ...new Set<string>(
            (body.sahitIdler as unknown[])
              .filter((x): x is string => typeof x === 'string' && !!x.trim())
              .map((x) => x.trim()),
          ),
        ]
      : []
    const gonder = body.gonder === true
    const tutanakTarihi = body.tutanakTarihi ? new Date(body.tutanakTarihi) : new Date()

    if (!personnelId) return NextResponse.json({ error: 'Personel seçilmedi.' }, { status: 400 })
    if (!SEBEPLER.includes(sebep)) return NextResponse.json({ error: 'Geçersiz tutanak sebebi.' }, { status: 400 })
    if (!aciklama) return NextResponse.json({ error: 'Açıklama zorunludur.' }, { status: 400 })
    if (sahitIdler.length === 0) return NextResponse.json({ error: 'En az bir şahit seçilmelidir.' }, { status: 400 })
    if (!yoneticiId) return NextResponse.json({ error: 'Yönetici seçilmelidir.' }, { status: 400 })
    if (Number.isNaN(tutanakTarihi.getTime())) {
      return NextResponse.json({ error: 'Tutanak tarihi geçersiz.' }, { status: 400 })
    }
    if (yetki.personnelId && personnelId === yetki.personnelId) {
      return NextResponse.json({ error: 'Kendiniz hakkında tutanak açamazsınız.' }, { status: 400 })
    }
    if (sahitIdler.includes(personnelId)) {
      return NextResponse.json(
        { error: 'Hakkında tutanak tutulan kişi kendi tutanağına şahit olamaz.' },
        { status: 400 },
      )
    }

    const personel = await prisma.personnel.findFirst({
      where: { id: personnelId, aktif: true },
      select: { id: true, adSoyad: true, sicilNo: true, bolum: true, gorev: true },
    })
    if (!personel) return NextResponse.json({ error: 'Aktif personel bulunamadı.' }, { status: 400 })

    // KAPSAM: müdür/müdür yrd. yalnız kendi bölümü + alt ağacı için açabilir.
    if (!yetki.tumBolumler) {
      const kapsam = yetki.kapsamBolumler.map((b) => b.name)
      if (!kapsam.includes(personel.bolum)) {
        return NextResponse.json(
          { error: 'Bu personel için tutanak açma yetkiniz yok (bölüm kapsamı dışında).' },
          { status: 403 },
        )
      }
    }

    // YÖNETİCİ: yalnız org zincirinin 1. ya da 2. basamağı seçilebilir — gövdeden
    // gelen rastgele bir personnelId onay sahibi yapılamaz.
    const zincir = await yoneticiZinciri(personnelId)
    const secilebilir = secilebilirBasamaklar(zincir)
    if (secilebilir.length === 0) {
      return NextResponse.json(
        { error: 'Personelin organizasyon şemasında yöneticisi bulunamadı — tutanak açılamaz.' },
        { status: 400 },
      )
    }
    if (!secilebilir.some((b) => b.personnelId === yoneticiId)) {
      return NextResponse.json(
        { error: 'Yönetici yalnız personelin 1. veya 2. yöneticisi arasından seçilebilir.' },
        { status: 400 },
      )
    }
    const kademe = kademeBul(zincir, yoneticiId)
    const sonYonetici = sonYoneticiSec(zincir, yoneticiId)

    const sahitler = await prisma.personnel.findMany({
      where: { id: { in: sahitIdler }, aktif: true },
      select: { id: true, bolum: true },
    })
    if (sahitler.length !== sahitIdler.length) {
      return NextResponse.json({ error: 'Şahitlerden biri aktif personel değil.' }, { status: 400 })
    }

    const acanAd = user.name || user.email || 'Bilinmeyen'

    // Numara çakışması: unique constraint ikinciyi düşürür, bir kez daha denenir.
    let olusan: { id: string; tutanakNo: string } | null = null
    for (let deneme = 0; deneme < 3 && !olusan; deneme++) {
      try {
        olusan = await prisma.$transaction(async (tx) => {
          const no = await yeniTutanakNo(tx)
          const t = await tx.tutanak.create({
            data: {
              tutanakNo: no,
              tutanakTarihi,
              personnelId: personel.id,
              bolumSnapshot: personel.bolum,
              gorevSnapshot: personel.gorev,
              sicilSnapshot: personel.sicilNo,
              adSoyadSnapshot: personel.adSoyad,
              sebep,
              aciklama,
              yoneticiId,
              yoneticiKademe: kademe ?? 1,
              bilgilendirilenSonYoneticiId: sonYonetici?.personnelId ?? null,
              acanUserId: user.id,
              acanPersonnelId: yetki.personnelId,
              acanRol: yetki.acanRol!,
              acanBolum: user.department ?? null,
              sahitler: {
                create: sahitler.map((s) => ({ personnelId: s.id, bolumSnapshot: s.bolum })),
              },
              gecmis: {
                create: {
                  adim: 'OLUSTURULDU',
                  aktorId: user.id,
                  aktorAd: acanAd,
                  yeniDurum: 'TASLAK',
                },
              },
            },
            select: { id: true, tutanakNo: true },
          })
          return t
        })
      } catch (err) {
        const kod = (err as { code?: string }).code
        if (kod !== 'P2002' || deneme === 2) throw err
      }
    }
    if (!olusan) return NextResponse.json({ error: 'Tutanak numarası üretilemedi.' }, { status: 500 })

    await logAuditEvent({
      action: 'TUTANAK_OLUSTURULDU',
      actorId: user.id,
      targetType: 'TUTANAK',
      targetId: olusan.id,
      details: {
        tutanakNo: olusan.tutanakNo,
        personnelId: personel.id,
        sebep,
        sahitSayisi: sahitler.length,
        yoneticiId,
        yoneticiKademe: kademe,
        sonYoneticiId: sonYonetici?.personnelId ?? null,
        acanRol: yetki.acanRol,
      },
    })

    // "Kaydet ve gönder": aynı akış motorundan geçer (geçiş matrisi + geçmiş + bildirim).
    if (gonder) {
      const sonuc = await tutanakAksiyonUygula({
        tutanakId: olusan.id,
        aksiyon: 'GONDER',
        aktor: { userId: user.id, ad: acanAd, personnelId: yetki.personnelId },
      })
      if (!sonuc.ok) {
        return NextResponse.json(
          { id: olusan.id, tutanakNo: olusan.tutanakNo, uyari: `Tutanak TASLAK kaydedildi, gönderilemedi: ${sonuc.hata}` },
          { status: 200 },
        )
      }
    }

    return NextResponse.json({ id: olusan.id, tutanakNo: olusan.tutanakNo }, { status: 201 })
  } catch (err) {
    console.error('Tutanak oluşturma hatası:', err)
    return NextResponse.json({ error: 'Tutanak oluşturulamadı' }, { status: 500 })
  }
}
