// GET /api/tutanak/[id]/pdf — IV-FR-03 düzeninde PDF.
// Görünürlük kapısı detay ucuyla AYNI (göremeyen kişi PDF de alamaz).
// Her açılış denetime düşer: tutanak gizli disiplin verisi, kim indirdi izlenir.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { tutanakGorebilir, tutanakYetkisiCore } from '@/lib/tutanak/tutanak-yetki'
import { DURUM_ETIKETLERI, SEBEP_ETIKETLERI } from '@/lib/tutanak/tutanak-durum'
import { generateTutanakPdfBuffer, type TutanakSahibiForPDF } from '@/lib/pdf/tutanak-pdf'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const { id } = await params

    const t = await prisma.tutanak.findUnique({
      where: { id },
      include: {
        yonetici: { select: { adSoyad: true, bolum: true } },
        bilgilendirilenSonYonetici: { select: { adSoyad: true, bolum: true } },
        acan: { select: { name: true, email: true } },
        sahitler: {
          orderBy: { createdAt: 'asc' },
          include: { personnel: { select: { adSoyad: true } } },
        },
      },
    })
    if (!t) return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })

    const yetki = await tutanakYetkisiCore(user.id, user.role, user.department)
    const gorme = tutanakGorebilir(
      {
        personnelId: t.personnelId,
        acanUserId: t.acanUserId,
        yoneticiId: t.yoneticiId,
        bilgilendirilenSonYoneticiId: t.bilgilendirilenSonYoneticiId,
        durum: t.durum,
        sahitler: t.sahitler.map((s) => ({ personnelId: s.personnelId, durum: s.durum })),
      },
      yetki,
    )
    if (!gorme.izinli) return NextResponse.json({ error: 'Tutanak bulunamadı' }, { status: 404 })

    // "Tutanak Sahipleri" tablosu: şahitler + onaylayanlar (kâğıt formdaki imza tablosu).
    const sahipler: TutanakSahibiForPDF[] = [
      ...t.sahitler.map((s) => ({
        rol: 'Şahit',
        adSoyad: s.personnel.adSoyad,
        bolum: s.bolumSnapshot,
        karar: s.durum as TutanakSahibiForPDF['karar'],
        kararAt: s.kararAt,
        not: s.not,
      })),
      {
        rol: `Yönetici (${t.yoneticiKademe}. kademe)`,
        adSoyad: t.yonetici.adSoyad,
        bolum: t.yonetici.bolum,
        karar: t.yoneticiKarar ?? 'BEKLIYOR',
        kararAt: t.yoneticiKararAt,
        not: t.yoneticiNot,
      },
    ]
    if (t.bilgilendirilenSonYonetici) {
      sahipler.push({
        rol: 'Son yönetici (bilgi)',
        adSoyad: t.bilgilendirilenSonYonetici.adSoyad,
        bolum: t.bilgilendirilenSonYonetici.bolum,
        karar: 'BILGI',
        kararAt: t.sonYoneticiBildirimAt,
        not: null,
      })
    }
    sahipler.push({
      rol: 'İnsan Varlıkları',
      adSoyad: t.ivKapanisAt ? 'İnsan Varlıkları' : '—',
      bolum: null,
      karar: t.ivKapanisAt ? 'KAPATTI' : 'BEKLIYOR',
      kararAt: t.ivKapanisAt,
      not: t.ivNot,
    })

    const buffer = generateTutanakPdfBuffer({
      tutanakNo: t.tutanakNo,
      tutanakTarihi: t.tutanakTarihi,
      durum: t.durum,
      durumEtiketi: DURUM_ETIKETLERI[t.durum],
      adSoyad: t.adSoyadSnapshot,
      sicilNo: t.sicilSnapshot,
      bolum: t.bolumSnapshot,
      gorev: t.gorevSnapshot,
      sebep: t.sebep,
      sebepEtiketi: SEBEP_ETIKETLERI[t.sebep],
      sebepSecenekleri: Object.entries(SEBEP_ETIKETLERI).map(([kod, etiket]) => ({ kod, etiket })),
      aciklama: t.aciklama,
      acanAd: t.acan?.name ?? t.acan?.email ?? '—',
      acanRolEtiketi: t.acanRol,
      sahipler,
    })

    await logAuditEvent({
      action: 'TUTANAK_PDF_ACILDI',
      actorId: user.id,
      targetType: 'TUTANAK',
      targetId: t.id,
      details: { tutanakNo: t.tutanakNo, gormeSebebi: gorme.sebep },
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${t.tutanakNo}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Tutanak PDF hatası:', err)
    return NextResponse.json({ error: 'PDF üretilemedi' }, { status: 500 })
  }
}
