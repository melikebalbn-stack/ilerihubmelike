// GET /api/tutanak/[id] — detay (görünürlük kapısı)
// PUT /api/tutanak/[id] — aksiyon: gonder | sahit-onay | sahit-ret |
//                         yonetici-onay | yonetici-ret | iv-kapat
//
// Onay yetkisi YALNIZ o adımın sahibine; platform yöneticisi bypass'ı YOK (§3).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import {
  TUTANAK_ONAY_YETKISI_YOK,
  tutanakGorebilir,
  tutanakOnaylayabilir,
  tutanakYetkisiCore,
} from '@/lib/tutanak/tutanak-yetki'
import { tutanakAksiyonUygula } from '@/lib/tutanak/tutanak-akis'
import type { TutanakAksiyon } from '@/lib/tutanak/tutanak-durum'

export const dynamic = 'force-dynamic'

const AKSIYONLAR: Record<string, TutanakAksiyon> = {
  gonder: 'GONDER',
  'sahit-onay': 'SAHIT_ONAY',
  'sahit-ret': 'SAHIT_RET',
  'yonetici-onay': 'YONETICI_ONAY',
  'yonetici-ret': 'YONETICI_RET',
  'iv-kapat': 'IV_KAPAT',
}

const DETAY_SELECT = {
  id: true,
  tutanakNo: true,
  tutanakTarihi: true,
  personnelId: true,
  adSoyadSnapshot: true,
  sicilSnapshot: true,
  bolumSnapshot: true,
  gorevSnapshot: true,
  sebep: true,
  aciklama: true,
  durum: true,
  gonderildiAt: true,
  redSebebi: true,
  yoneticiId: true,
  yoneticiKademe: true,
  yoneticiKarar: true,
  yoneticiNot: true,
  yoneticiKararAt: true,
  bilgilendirilenSonYoneticiId: true,
  sonYoneticiBildirimAt: true,
  ivKapanisAt: true,
  ivNot: true,
  acanUserId: true,
  acanRol: true,
  createdAt: true,
  yonetici: { select: { adSoyad: true, bolum: true, gorev: true } },
  bilgilendirilenSonYonetici: { select: { adSoyad: true, bolum: true, gorev: true } },
  acan: { select: { name: true, email: true } },
  sahitler: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      personnelId: true,
      bolumSnapshot: true,
      durum: true,
      not: true,
      kararAt: true,
      personnel: { select: { adSoyad: true, sicilNo: true, gorev: true } },
    },
  },
  gecmis: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, adim: true, aktorAd: true, not: true, oncekiDurum: true, yeniDurum: true, createdAt: true },
  },
} as const

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const { id } = await params

    const t = await prisma.tutanak.findUnique({ where: { id }, select: DETAY_SELECT })
    if (!t) return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })

    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    const kimlik = {
      personnelId: t.personnelId,
      acanUserId: t.acanUserId,
      yoneticiId: t.yoneticiId,
      bilgilendirilenSonYoneticiId: t.bilgilendirilenSonYoneticiId,
      durum: t.durum,
      sahitler: t.sahitler.map((s) => ({ personnelId: s.personnelId, durum: s.durum })),
    }
    const gorme = tutanakGorebilir(kimlik, yetki)
    if (!gorme.izinli) {
      // Hakkında tutanak tutulan kişiye "yetkiniz yok" demek bile kaydın
      // varlığını sızdırır → 404 (fail-closed, kadro talep deseni).
      return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })
    }

    const onay = tutanakOnaylayabilir(kimlik, yetki)
    return NextResponse.json({
      tutanak: t,
      gormeSebebi: gorme.sebep,
      onaylayabilir: onay.izinli,
      adimSahibi: onay.sahip,
      iv: yetki.iv,
    })
  } catch (err) {
    console.error('Tutanak detay hatası:', err)
    return NextResponse.json({ error: 'Tutanak alınamadı' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const { id } = await params
    const body = await request.json()

    const aksiyon = AKSIYONLAR[String(body.aksiyon ?? '')]
    if (!aksiyon) return NextResponse.json({ error: 'Geçersiz işlem.' }, { status: 400 })

    const t = await prisma.tutanak.findUnique({
      where: { id },
      select: {
        personnelId: true,
        acanUserId: true,
        yoneticiId: true,
        bilgilendirilenSonYoneticiId: true,
        durum: true,
        sahitler: { select: { personnelId: true, durum: true } },
      },
    })
    if (!t) return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })

    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    // Görünürlük kapısı ÖNCE: göremeyen kişi işlem de yapamaz.
    if (!tutanakGorebilir(t, yetki).izinli) {
      return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })
    }
    const onay = tutanakOnaylayabilir(t, yetki)
    if (!onay.izinli) return NextResponse.json({ error: TUTANAK_ONAY_YETKISI_YOK }, { status: 403 })

    // Aksiyon ile adım sahibi TÜRÜ uyuşmalı: şahit, yönetici adımını onaylayamaz.
    const beklenen: Record<TutanakAksiyon, string> = {
      GONDER: 'ACAN',
      SAHIT_ONAY: 'SAHIT',
      SAHIT_RET: 'SAHIT',
      YONETICI_ONAY: 'YONETICI',
      YONETICI_RET: 'YONETICI',
      IV_KAPAT: 'IV',
    }
    if (onay.sahip.tur !== beklenen[aksiyon]) {
      return NextResponse.json({ error: TUTANAK_ONAY_YETKISI_YOK }, { status: 403 })
    }

    const sonuc = await tutanakAksiyonUygula({
      tutanakId: id,
      aksiyon,
      aktor: { userId: user.id, ad: user.name || user.email || 'Bilinmeyen', personnelId: yetki.personnelId },
      not: typeof body.not === 'string' ? body.not : null,
    })
    if (!sonuc.ok) return NextResponse.json({ error: sonuc.hata }, { status: sonuc.kod })

    return NextResponse.json({ ok: true, durum: sonuc.yeniDurum })
  } catch (err) {
    console.error('Tutanak işlem hatası:', err)
    return NextResponse.json({ error: 'İşlem tamamlanamadı' }, { status: 500 })
  }
}
