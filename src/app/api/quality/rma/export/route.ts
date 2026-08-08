import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { buildRmaWhere } from '@/lib/quality/rma-query'
import {
  RMA_TIP_LABELS,
  RMA_IADE_TURU_LABELS,
  RMA_KARAR_LABELS,
} from '@/lib/quality/rma-labels'
import { EXPORT_HEADERS, formatDateTR } from '@/lib/quality/rma-excel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/rma/export — liste ekranı filtreleriyle Excel (satır bazlı düz tablo).
 * Auth: oturum (herkes okur; liste ucuyla aynı yetki). Filtre: buildRmaWhere (TEK KAYNAK).
 * Kayıt bilgileri her satırda tekrar eder (Excel orijinal düzeni). Enum'lar Türkçe etiket.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildRmaWhere(request.nextUrl.searchParams)

  const kayitlar = await prisma.rmaKayit.findMany({
    where,
    orderBy: { no: 'desc' },
    include: {
      musteri: { select: { name: true, code: true } },
      sorumlu: { select: { adSoyad: true } },
      satirlar: { orderBy: { siraNo: 'asc' } },
    },
  })

  // Satır bazlı düz tablo (aoa) — başlık + her ürün satırı için kayıt bilgisi tekrar eder.
  const rows: (string | number)[][] = [ [...EXPORT_HEADERS] ]

  for (const k of kayitlar) {
    const durum = k.kapanisTarihi ? 'Kapalı' : 'Açık'
    const kayitAlanlari = [
      RMA_TIP_LABELS[k.tip],
      k.no,
      formatDateTR(k.urunGelisTarihi),
      formatDateTR(k.irsaliyeTarihi),
      k.irsaliyeNo ?? '',
      k.musteri?.code ?? '',
      k.musteri?.name ?? '',
      k.iadeTuru ? RMA_IADE_TURU_LABELS[k.iadeTuru] : '',
      k.sorumlu?.adSoyad ?? '',
      formatDateTR(k.termin),
      formatDateTR(k.kapanisTarihi),
      k.maliyet != null ? Number(k.maliyet) : '',
      durum,
    ]
    const satirlar = k.satirlar.length > 0 ? k.satirlar : [null]
    for (const s of satirlar) {
      rows.push([
        ...kayitAlanlari,
        s?.siraNo ?? '',
        s?.urunKodu ?? '',
        s?.lotNo ?? '',
        s?.iadeMiktari ?? '',
        s?.musteriIadeSebebi ?? '',
        s?.ilkIncelemeSonucu ?? '',
        s?.karar ? RMA_KARAR_LABELS[s.karar] : '',
        s?.kararAciklama ?? '',
        s?.hurdaAdedi ?? '',
        s?.reworkAdedi ?? '',
        s?.kokNeden ?? '',
        s?.aksiyon ?? '',
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'RMA-SMA')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="RMA-Listesi-${stamp}.xlsx"`,
    },
  })
}
