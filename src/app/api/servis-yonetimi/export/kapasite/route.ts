import { NextRequest, NextResponse } from 'next/server'
import { hesapTarihiCoz, servisKapasiteTopluGetir } from '@/lib/servis-yonetimi/kapasite'
import { kapasiteExcelDosyaAdi, kapasiteExcelOlustur } from '@/lib/servis-yonetimi/kapasite-excel'
import {
  exportDenetimiHatasi,
  exportDenetimiYaz,
  exportYetkisiIste,
} from '@/lib/servis-yonetimi/export-denetim'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/kapasite?tarih=YYYY-MM-DD — Kapasite Raporu (Excel).
// Servis Paneli ile AYNI kaynak (kapasite motoru). Yetki: servis.view VE servis.export;
// denetim fail-closed. KVKK: kişi bilgisi yok (güzergâh, plaka, sayı).
export async function GET(request: NextRequest) {
  const { error, userId } = await exportYetkisiIste()
  if (error) return error

  let tarih: Date
  try {
    tarih = hesapTarihiCoz(request.nextUrl.searchParams.get('tarih'))
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : 'Geçersiz tarih.' }, { status: 400 })
  }

  try {
    const toplu = await servisKapasiteTopluGetir(tarih)
    const buf = kapasiteExcelOlustur(toplu)
    if (!(await exportDenetimiYaz(userId, {
      rapor: 'KAPASITE_EXCEL', format: 'XLSX', satirSayisi: toplu.guzergahlar.length, filtre: { tarih: toplu.tarih },
    }))) {
      return exportDenetimiHatasi()
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${kapasiteExcelDosyaAdi(toplu.tarih)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Kapasite Excel export hatası:', err)
    return NextResponse.json({ ok: false, message: 'Excel oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
