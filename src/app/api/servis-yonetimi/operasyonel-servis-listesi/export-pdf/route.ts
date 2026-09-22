import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { operasyonelServisListesiGetir } from '@/lib/servis-yonetimi/operasyonel-servis-listesi'
import { gecmisTarihNotuOlustur } from '@/lib/servis-yonetimi/operasyonel-servis-listesi-excel'
import { generateOperasyonelServisListesiPdfBuffer } from '@/lib/pdf/operasyonel-servis-listesi-pdf'
import { operasyonelListeFiltreleriniAyikla } from '../_filtre'

export const dynamic = 'force-dynamic'

// MASTER Madde 29 — PDF export. Permission Excel ile AYNI (servis.export).
// Sorgu/filtre mantığı ÜÇÜNCÜ KEZ yazılmaz (rule 6) — liste ve Excel
// uçlarıyla AYNI operasyonelServisListesiGetir() + _filtre.ts kullanılır.
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.export')
  if (error) return error

  const ayiklama = operasyonelListeFiltreleriniAyikla(request.nextUrl.searchParams)
  if (!ayiklama.ok) {
    return NextResponse.json({ ok: false, message: ayiklama.mesaj }, { status: 400 })
  }

  try {
    const sonuc = await operasyonelServisListesiGetir(ayiklama.filtre)
    // 🔴 Geçmiş tarih uyarısı PDF'İN İÇİNE de yazılır — Excel'deki aynı
    // gerekçeyle (dosya firmaya gidiyor, uygulama dışında okunuyor).
    const not = sonuc.gecmisTarihSecildi ? gecmisTarihNotuOlustur(sonuc.tarih) : undefined
    const buf = generateOperasyonelServisListesiPdfBuffer({ tarih: sonuc.tarih, satirlar: sonuc.satirlar, not })

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Operasyonel-Servis-Listesi-${sonuc.tarih}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Operasyonel servis listesi PDF export hatası:', err)
    return NextResponse.json({ ok: false, message: 'PDF oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
