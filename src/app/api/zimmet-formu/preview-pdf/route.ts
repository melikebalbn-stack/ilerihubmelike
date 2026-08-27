import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { requirePermission } from '@/lib/auth/require-permission'
import { ZimmetTuru, ZimmetCihazDurumu } from '@/generated/prisma'
import { generateZimmetPdf, type ZimmetPdfData } from '@/lib/zimmet/pdf'
import { APPROVER_USER_ID, APPROVER_NAME } from '@/lib/zimmet/constants'
import { zimmetEksikAlanlar } from '@/lib/zimmet/zorunlu-alanlar'

const TUR_VALUES: string[] = Object.values(ZimmetTuru)
const CIHAZ_DURUMU_VALUES: string[] = Object.values(ZimmetCihazDurumu)

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// POST - Taslak PDF önizleme: henüz kaydedilmemiş form verisiyle PDF üretir.
// Alan bazında gerçek POST'a göre daha TOLERANSLI (örn. geçersiz Tür DIGER'e
// düşer, hata vermez) — ama zorunlu alanlar (Zimmet Sahibi, Tür + türe göre
// değişen ek alanlar) yine de boş olamaz; istemci taraflı buton disable'ı UI
// için, asıl güvenlik/tutarlılık katmanı burasıdır (buton bypass edilip
// API'ye doğrudan istek atılsa bile boş önizleme üretilemez).
export async function POST(request: NextRequest) {
  try {
    const { error: permError } = await requirePermission('zimmet-formu.create')
    if (permError) return permError

    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()

    // Zimmet Sahibi + Tür sabit zorunlu. Türe göre değişen ek zorunlu alanlar
    // (Seri No/Özellik/IMEI/Hangi yazılım) src/lib/zimmet/zorunlu-alanlar.ts'ten
    // (zimmetEksikAlanlar) - gerçek POST'la (route.ts) AYNI tablo.
    const eksikAlanlar: string[] = []
    if (!body.zimmetSahibiId || typeof body.zimmetSahibiId !== 'string' || !body.zimmetSahibiId.trim()) {
      eksikAlanlar.push('zimmetSahibiId')
    }
    if (!body.tur || typeof body.tur !== 'string' || !body.tur.trim()) {
      eksikAlanlar.push('tur')
    }
    eksikAlanlar.push(...zimmetEksikAlanlar(typeof body.tur === 'string' ? body.tur : '', body))

    if (eksikAlanlar.length > 0) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik', eksikAlanlar },
        { status: 400 }
      )
    }

    const zimmetSahibiId = optionalString(body.zimmetSahibiId)
    let zimmetSahibiAdi = '—'
    let unvan: string | undefined
    let sicilNo: string | undefined
    if (zimmetSahibiId) {
      const zimmetSahibi = await prisma.user.findUnique({ where: { id: zimmetSahibiId } })
      if (zimmetSahibi) {
        zimmetSahibiAdi = zimmetSahibi.name ?? zimmetSahibi.email
        unvan = zimmetSahibi.jobTitle ?? undefined
        sicilNo = zimmetSahibi.employeeId ?? undefined
      }
    }

    // Onaylayan tek kişi (Melih Dilben) - önizlemede henüz onay yokken bile
    // ismi/ünvanı gösterilir (bkz. zimmet-pdf.ts). Ünvan değişebileceği için
    // sabit yazmak yerine DB'den her seferinde çekiliyor.
    const approver = await prisma.user.findUnique({
      where: { id: APPROVER_USER_ID },
      select: { name: true, email: true, jobTitle: true },
    })

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
      unvan,
      sicilNo,
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
      macAdresi: optionalString(body.macAdresi),
      pcAdi: optionalString(body.pcAdi),
      imeiNumarasi: optionalString(body.imeiNumarasi),
      verilisTarihi,
      cihazDurumu,
      durum: 'ONAY_BEKLIYOR',
      teslimNotu: optionalString(body.teslimNotu),
      teslimEdenAdi: user.name ?? user.email,
      teslimEdenUnvan: user.jobTitle,
      teslimEdenBolum: user.department,
      onaylayanAdi: approver?.name ?? approver?.email ?? APPROVER_NAME,
      onaylayanUnvan: approver?.jobTitle ?? undefined,
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
