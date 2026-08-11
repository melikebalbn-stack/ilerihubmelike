import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { buildUygunsuzlukWhere } from '@/lib/quality/uygunsuzluk-query'
import { UYGUNSUZLUK_KARAR_LABELS, redOrani } from '@/lib/quality/uygunsuzluk-labels'
import {
  EXPORT_HEADERS,
  RED_ORANI_COL,
  formatDateTR,
} from '@/lib/quality/uygunsuzluk-excel'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quality/uygunsuzluk/export — Excel (.xlsx).
 * Auth: oturum (herkes okur; liste ucuyla aynı yetki).
 * Filtre: buildUygunsuzlukWhere (TEK KAYNAK — liste ucuyla birebir aynı fonksiyon).
 *
 * SATIR BAZLI düz tablo: her uygunsuzluk satırı bir Excel satırı, başlık alanları
 * tekrar eder — Excel'in orijinal yapısı böyle.
 *
 * RED ORANI KAYIT BAZINDA hesaplanır: kaydın TOPLAM red adeti / iş emri adeti.
 * Aynı kaydın her satırında AYNI değer görünür (Excel'in orijinal düzeni gibi).
 * Hesap `redOrani()` — TEK KAYNAK (liste ekranı ve form da onu kullanır).
 * SAYISAL oran yazılır, hücreye `0.0%` biçimi verilir. İş emri adeti boş ya da 0
 * ise hücre BOŞ bırakılır — "%0" ya da "#DIV/0!" YAZILMAZ.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireSession()
  if (error) return error

  const where = buildUygunsuzlukWhere(request.nextUrl.searchParams)

  const kayitlar = await prisma.kaliteUygunsuzluk.findMany({
    where,
    orderBy: { no: 'desc' },
    include: {
      tespitEdenBolum: { select: { kod: true, ad: true } },
      sorumlu: { select: { adSoyad: true } },
      satirlar: {
        orderBy: { siraNo: 'asc' },
        include: {
          olusanBolum: { select: { kod: true, ad: true } },
          hataKodu: { select: { kod: true, ad: true } },
        },
      },
    },
  })

  const rows: (string | number)[][] = [[...EXPORT_HEADERS]]

  for (const k of kayitlar) {
    const durum = k.kapanisTarihi ? 'Kapalı' : 'Açık'
    const tespitEden = k.tespitEdenBolum
      ? `${k.tespitEdenBolum.kod} ${k.tespitEdenBolum.ad}`
      : ''
    // Kayıt bazlı oran: TOPLAM red / iş emri adeti. Payda yoksa null → hücre boş.
    const toplamRed = k.satirlar.reduce((t, x) => t + x.redAdeti, 0)
    const oranYuzde = redOrani(toplamRed, k.isEmriAdeti)
    // redOrani() yüzde döndürür (ör. 5.4); Excel hücresi oran bekler (0.054).
    const oran = oranYuzde === null ? '' : oranYuzde / 100

    // Satırı olmayan kayıt da tabloda görünsün (tek satır, satır alanları boş).
    const satirlar = k.satirlar.length > 0 ? k.satirlar : [null]

    for (const s of satirlar) {

      rows.push([
        formatDateTR(k.tarih),
        k.mamulUrunKodu,
        s?.yariMamulKodu ?? '',
        s?.malzemeAdi ?? '',
        k.isEmriNo,
        k.isEmriAdeti ?? '',
        s?.redAdeti ?? '',
        oran,
        s?.reworkAdedi ?? '',
        tespitEden,
        s?.olusanBolum ? `${s.olusanBolum.kod} ${s.olusanBolum.ad}` : '',
        s?.hataKodu ? `${s.hataKodu.kod} ${s.hataKodu.ad}` : '',
        s?.hataDetayi ?? '',
        s?.karar ? UYGUNSUZLUK_KARAR_LABELS[s.karar] : '',
        k.kokNeden ?? '',
        k.duzelticiFaaliyet ?? '',
        k.sorumlu?.adSoyad ?? '',
        formatDateTR(k.termin),
        formatDateTR(k.kapanisTarihi),
        durum,
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }))

  // RED ORANI hücrelerine yüzde biçimi (yalnız sayısal olanlara).
  for (let r = 1; r < rows.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: RED_ORANI_COL })
    const cell = ws[addr]
    if (cell && typeof cell.v === 'number') cell.z = '0.0%'
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Uygunsuzluk')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Uygunsuzluk-Listesi-${stamp}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
