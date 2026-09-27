import { NextResponse } from 'next/server'
import { hataYaniti } from '../../_hata'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { raporRender } from '@/lib/rapor/render'
import { tuvalRender } from '@/lib/rapor/tuval-render'
import { veriSetiAlanlari } from '@/lib/rapor/veri-seti-alanlar'
import { ifadeCalistir, ifadeDerle } from '@/lib/rapor/ifade'
import { etkilesimliMi, type SablonIcerik } from '@/lib/rapor/tipler'
import { calistirmaHatasiKaydet, calistirmaKaydet, raporBaglami, tuvalGorselleri } from '@/lib/rapor/sunucu-calistirma'

export const dynamic = 'force-dynamic'

const GovdeSchema = z.object({
  parametreler: z.record(z.string(), z.unknown()).default({}),
  cikti: z.enum(['EKRAN', 'XLSX']).default('EKRAN'),
})

/** Satırlara hesaplanan alanları ekler (XLSX yolu; EKRAN'da render bunu kendisi yapar). */
function hesaplananlariUygula(icerik: SablonIcerik, satirlar: Record<string, unknown>[]): Record<string, unknown>[] {
  const hesaplananlar = (icerik.hesaplananAlanlar ?? []).map((h) => ({ ad: h.ad, d: ifadeDerle(h.ifade) }))
  if (!hesaplananlar.length) return satirlar
  return satirlar.map((s) => {
    const y = { ...s }
    for (const h of hesaplananlar) y[h.ad] = ifadeCalistir(h.d, { satir: y })
    return y
  })
}

function xlsxDegeri(v: unknown): ExcelJS.CellValue {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'bigint') return Number(v)
  if (typeof v === 'object' && typeof (v as { toNumber?: unknown }).toNumber === 'function') return (v as { toNumber: () => number }).toNumber()
  return String(v)
}

async function xlsxUret(icerik: SablonIcerik, satirlar: Record<string, unknown>[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(icerik.baslik.slice(0, 31).replace(/[\\/*?:[\]]/g, ' ') || 'Rapor')
  ws.columns = icerik.kolonlar.map((k) => ({ header: k.baslik, key: k.alan, width: Math.max(12, Math.min(40, k.baslik.length + 4)) }))
  ws.getRow(1).font = { bold: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  for (const s of hesaplananlariUygula(icerik, satirlar)) {
    const satir: Record<string, ExcelJS.CellValue> = {}
    for (const k of icerik.kolonlar) {
      let v = xlsxDegeri(s[k.alan])
      if (typeof v === 'string' && (k.bicim?.startsWith('gg') ?? false)) { const d = new Date(v); if (!Number.isNaN(d.getTime())) v = d }
      satir[k.alan] = v
    }
    ws.addRow(satir)
  }
  icerik.kolonlar.forEach((k, i) => {
    const col = ws.getColumn(i + 1)
    switch (k.bicim) {
      case '#.##0': col.numFmt = '#,##0'; break
      case '#.##0,00': col.numFmt = '#,##0.00'; break
      case '%0,0': col.numFmt = '0.0"%"'; break
      case '%0,00': col.numFmt = '0.00"%"'; break
      case 'gg.aa.yyyy': col.numFmt = 'dd.mm.yyyy'; break
      case 'gg.aa.yyyy ss:dd': col.numFmt = 'dd.mm.yyyy hh:mm'; break
    }
  })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/**
 * POST /api/raporlar/[id]/calistir — BELGE şablonunu çalıştırır (EKRAN: HTML JSON, XLSX: dosya).
 * Yetki/parametre/kayıt: sunucu-calistirma. Etkileşimli şablon için /veri ve /excel uçları kullanılır.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error
  const { id } = await params

  let govdeHam: unknown
  try { govdeHam = await req.json() } catch { govdeHam = {} }
  const govde = GovdeSchema.safeParse(govdeHam ?? {})
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  const b = await raporBaglami(id, userId, govde.data.parametreler, govde.data.cikti)
  if (b.hata) return b.hata
  const { sablon, icerik, tanim, degerler, kayit, calistiranAd } = b.baglam
  if (etkilesimliMi(icerik)) return NextResponse.json({ error: 'AI Rapor: /veri veya /excel ucunu kullanın' }, { status: 400 })

  const t0 = Date.now()
  try {
    const veri = await veriSetiCalistir(tanim, degerler)

    if (govde.data.cikti === 'XLSX') {
      const buffer = await xlsxUret(icerik, veri.satirlar)
      await calistirmaKaydet(kayit, veri.satirlar.length, Date.now() - t0)
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${sablon.kod}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // Tuval yerleşimi → serbest yerleşim motoru; 'liste' (veya yok) → mevcut bantlı tablo motoru.
    if (icerik.yerlesim === 'tuval' && icerik.tuval) {
      const degerEtiketleri = Object.fromEntries((await veriSetiAlanlari(tanim)).filter((a) => a.degerEtiketleri).map((a) => [a.ad, a.degerEtiketleri!]))
      const { logoUrl, gorseller } = await tuvalGorselleri(icerik.tuval)
      const t = tuvalRender(icerik.tuval, veri.satirlar, {
        hesaplananAlanlar: icerik.hesaplananAlanlar, parametreler: degerler, parametreTanimlari: icerik.parametreler,
        degerEtiketleri, raporAdi: icerik.baslik, raporKodu: sablon.kod, calistiran: calistiranAd, logoUrl, gorseller,
      })
      const sureMs = Date.now() - t0
      await calistirmaKaydet(kayit, t.satirSayisi, sureMs)
      return NextResponse.json({ html: t.html, satirSayisi: t.satirSayisi, sayfaSayisi: t.sayfaSayisi, sureMs, kaynakIstatistik: veri.kaynakIstatistik })
    }

    const render = raporRender(icerik, veri.satirlar, { parametreler: degerler, calistiran: calistiranAd, raporKodu: sablon.kod })
    const sureMs = Date.now() - t0
    await calistirmaKaydet(kayit, render.satirSayisi, sureMs)
    return NextResponse.json({ html: render.html, satirSayisi: render.satirSayisi, sureMs, kaynakIstatistik: veri.kaynakIstatistik })
  } catch (e) {
    await calistirmaHatasiKaydet(kayit, sablon.kod, Date.now() - t0, e)
    return hataYaniti(e, {}, 500, `rapor:${sablon.kod}`)
  }
}
