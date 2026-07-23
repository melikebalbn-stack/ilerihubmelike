import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetTuru, ZimmetCihazDurumu } from '@/generated/prisma'
import { generateZimmetPdf, type ZimmetPdfData } from '@/lib/zimmet/pdf'

const TUR_VALUES: string[] = Object.values(ZimmetTuru)
const CIHAZ_DURUMU_VALUES: string[] = Object.values(ZimmetCihazDurumu)

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// POST - Taslak PDF önizleme: henüz kaydedilmemiş form verisiyle PDF üretir.
// Gerçek POST'un aksine TOLERANSLI doğrulama yapar (taslak önizleme, eksik/
// geçersiz alan formu reddetmez — sadece "—" olarak gösterilir).
export async function POST(request: NextRequest) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.create')
    if (permError) return permError

    // `user` önizleme PDF'inde "teslim eden" adı için gerekli.
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()

    const zimmetSahibiId = optionalString(body.zimmetSahibiId)
    let zimmetSahibiAdi = '—'
    if (zimmetSahibiId) {
      const zimmetSahibi = await prisma.user.findUnique({ where: { id: zimmetSahibiId } })
      if (zimmetSahibi) zimmetSahibiAdi = zimmetSahibi.name ?? zimmetSahibi.email
    }

    const turRaw = typeof body.tur === 'string' ? body.tur : ''
    const tur = TUR_VALUES.includes(turRaw) ? (turRaw as ZimmetTuru) : ZimmetTuru.DIGER
    const cihazDurumu = CIHAZ_DURUMU_VALUES.includes(body.cihazDurumu)
      ? (body.cihazDurumu as ZimmetCihazDurumu)
      : ZimmetCihazDurumu.AKTIF

    let verilisTarihi: Date | null = null
    if (typeof body.verilisTarihi === 'string' && body.verilisTarihi.trim()) {
      const parsed = new Date(body.verilisTarihi)
      if (!Number.isNaN(parsed.getTime())) verilisTarihi = parsed
    }

    const pdfData: ZimmetPdfData = {
      id: 'Önizleme',
      zimmetSahibiAdi,
      altZimmetSahibi: optionalString(body.altZimmetSahibi),
      departman: optionalString(body.departman),
      tur,
      turDiger: optionalString(body.turDiger),
      marka: optionalString(body.marka) ?? undefined,
      model: optionalString(body.model) ?? undefined,
      teslimEdenImzalandi: body.teslimEdenImzalandi === true,
      teslimEdenImzaTarihi: optionalString(body.teslimEdenImzaTarihi) ?? undefined,
      seriNumarasi: optionalString(body.seriNumarasi),
      aciklama: optionalString(body.aciklama),
      ozellik: optionalString(body.ozellik),
      ram: optionalString(body.ram) ?? undefined,
      ipAdresi: optionalString(body.ipAdresi) ?? undefined,
      parcaNo: optionalString(body.parcaNo) ?? undefined,
      lisansBaslangic: optionalString(body.lisansBaslangic) ?? undefined,
      lisansBitis: optionalString(body.lisansBitis) ?? undefined,
      macAdresi: optionalString(body.macAdresi),
      pcAdi: optionalString(body.pcAdi),
      imeiNumarasi: optionalString(body.imeiNumarasi),
      verilisTarihi,
      cihazDurumu,
      durum: 'ONAY_BEKLIYOR',
      teslimNotu: optionalString(body.teslimNotu),
      teslimEdenAdi: user.name ?? user.email,
      createdAt: new Date(),
    }

    const pdfBytes = await generateZimmetPdf(pdfData)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="zimmet-onizleme.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[POST /api/zimmet-formu/preview-pdf]', err)
    return NextResponse.json({ error: 'Önizleme oluşturulamadı' }, { status: 500 })
  }
}
