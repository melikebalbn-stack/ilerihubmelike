import { NextResponse } from 'next/server'
import { excelOnizle, hataRaporuDosyaAdi, hataRaporuOlustur } from '@/lib/servis-yonetimi/excel-atama'
import { bugunTR } from '@/lib/servis-yonetimi/tarih-kurallari'
import { excelIstegiOku } from '../_ortak'

export const dynamic = 'force-dynamic'

// dosya yükleme için view, operasyonel atama kaydı için edit — İKİSİ BİRDEN (AND)
const YETKILER = ['servis.view', 'servis.edit']

// POST .../personel-atama-excel/hata-raporu (multipart: dosya) — hatalı satırların Excel raporu
// (satır no, sicil, kodlar, hata). Dosya yeniden doğrulanır; hiçbir kayıt yazılmaz.
export async function POST(request: Request) {
  const girdi = await excelIstegiOku(request, YETKILER)
  if ('error' in girdi) return girdi.error
  try {
    const o = await excelOnizle(girdi.satirlar, girdi.izinler)
    const buf = hataRaporuOlustur(o.satirlar)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${hataRaporuDosyaAdi(bugunTR())}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    console.error('Excel atama hata raporu hatası')
    return NextResponse.json({ ok: false, message: 'Hata raporu oluşturulamadı.' }, { status: 500 })
  }
}
