import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requirePermission } from '@/lib/auth/require-permission'
import { analizVerisi } from '@/lib/ipro/analiz-service'
import { analizFiltreCoz } from '../route'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const yuzde = (v: number | null) => (v == null ? '' : Number((v * 100).toFixed(1)))

/** GET /api/ipro/analiz/excel — tezgah tablosu + dönem özeti (exceljs). IPRO görüntüleme izni. */
export async function GET(req: Request) {
  const { error } = await requirePermission(['ipro.view', 'ipro.admin'])
  if (error) return error
  try {
    const f = analizFiltreCoz(new URL(req.url).searchParams)
    const v = await analizVerisi(f)
    const wb = new ExcelJS.Workbook()

    const ozet = wb.addWorksheet('Dönem Özeti')
    ozet.columns = [{ header: 'Metrik', width: 22 }, { header: 'Değer %', width: 12 }, { header: 'Önceki döneme fark (puan)', width: 26 }]
    ozet.getRow(1).font = { bold: true }
    const d = v.donem
    const satir = (ad: string, deg: number | null, fark: number | null) => ozet.addRow([ad, yuzde(deg), fark == null ? '' : Number((fark * 100).toFixed(1))])
    satir('OEE', d.oee, d.oncekiFark.oee)
    satir('Kullanılabilirlik', d.availability, d.oncekiFark.availability)
    satir('Performans', d.performance, d.oncekiFark.performance)
    satir('Kalite', d.quality, d.oncekiFark.quality)
    ozet.addRow([])
    ozet.addRow(['Aralık', `${f.bas.toISOString().slice(0, 10)} – ${f.bit.toISOString().slice(0, 10)}`])

    const tz = wb.addWorksheet('Tezgah Bazında')
    tz.columns = [
      { header: 'Tezgah', width: 12 }, { header: 'Bölüm', width: 24 },
      { header: 'OEE %', width: 10 }, { header: 'Kullanılabilirlik %', width: 18 }, { header: 'Performans %', width: 14 }, { header: 'Kalite %', width: 10 },
      { header: 'Adet', width: 12 }, { header: 'Hurda', width: 10 }, { header: 'Duruş dk', width: 10 }, { header: 'Çevrim', width: 12 },
    ]
    tz.getRow(1).font = { bold: true }
    for (const t of v.tezgahlar) {
      tz.addRow([t.kod, t.bolum ?? '', yuzde(t.oee), yuzde(t.availability), yuzde(t.performance), yuzde(t.quality), t.adet, t.hurda, t.durusDk, t.cevrimDurum ?? ''])
    }

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ipro-analiz-${f.bas.toISOString().slice(0, 10)}_${f.bit.toISOString().slice(0, 10)}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return iproHata(e, 'Excel oluşturulamadı')
  }
}
