import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import {
  exportDenetimiHatasi,
  exportDenetimiYaz,
  exportYetkisiIste,
} from '@/lib/servis-yonetimi/export-denetim'
import { operasyonelServisListesiGetir } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'
import {
  gecmisTarihNotuOlustur,
  operasyonelServisListesiSatirlariOlustur,
} from '@/lib/servis-yonetimi/operasyonel-servis-listesi-excel'
import { operasyonelListeFiltreleriniAyikla } from '../_filtre'

export const dynamic = 'force-dynamic'

// MASTER Madde 29 — Excel export. Yetki: servis.view VE servis.export (B3: AND) —
// dışa aktarma ekranı görüntülemeden daha hassas ama ekrandan bağımsız değildir.
// Sorgu mantığı burada TEKRARLANMAZ (rule 6) — liste ucuyla AYNI
// operasyonelServisListesiGetir() çağrılır.
export async function GET(request: NextRequest) {
  const { error, userId } = await exportYetkisiIste()
  if (error) return error

  const ayiklama = operasyonelListeFiltreleriniAyikla(request.nextUrl.searchParams)
  if (!ayiklama.ok) {
    return NextResponse.json({ ok: false, message: ayiklama.mesaj }, { status: 400 })
  }

  try {
    const sonuc = await operasyonelServisListesiGetir(ayiklama.filtre)
    // 🔴 Geçmiş tarih uyarısı Excel'İN İÇİNE de yazılır — bu dosya servis
    // firmasına gidiyor, uygulamanın dışında açılıyor; ekrandaki uyarı orada
    // görünmez (bkz. gecmisTarihNotuOlustur).
    const not = sonuc.gecmisTarihSecildi ? gecmisTarihNotuOlustur(sonuc.tarih) : undefined
    const rows = operasyonelServisListesiSatirlariOlustur(sonuc.satirlar, not)

    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Servis Listesi')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer
    if (!(await exportDenetimiYaz(userId, { rapor: 'OPERASYONEL_SERVIS_LISTESI_EXCEL', format: 'XLSX', satirSayisi: sonuc.satirlar.length, filtre: { tarih: sonuc.tarih } }))) {
      return exportDenetimiHatasi()
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Operasyonel-Servis-Listesi-${sonuc.tarih}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Operasyonel servis listesi export hatası:', err)
    return NextResponse.json({ ok: false, message: 'Excel oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
