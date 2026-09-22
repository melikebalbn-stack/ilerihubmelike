import { NextRequest, NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { acilDurumListesiGetir, AcilDurumListesiError } from '@/lib/servis-yonetimi/acil-durum-listesi'
import {
  acilDurumErisimIziYaz,
  istekIpAdresi,
  AUDIT_ACTION_GORUNTULEME,
  ERISIM_TIPI_GORUNTULEME,
} from './_erisim-izi'

export const dynamic = 'force-dynamic'

// MASTER Madde 49 — Acil Durum Servis Listesi.
//
// YETKİ: servis.view VE servis.kvkk.view — İKİSİ BİRDEN (requireAllPermissions,
// AND mantığı). servis.export KULLANILMAZ: o "dışa aktarma" ekseni, buradaki
// kısıt "iletişim verisini görme". Normal servis ekranlarını görebilen
// (servis.view'lı) bir kullanıcı bu ekranı GÖREMEZ.
//
// KVKK erişim izi (iki mekanizma, hata yutan) → _erisim-izi.ts (PDF ucuyla
// paylaşılıyor).
export async function GET(request: NextRequest) {
  const { userId, error } = await requireAllPermissions(['servis.view', 'servis.kvkk.view'])
  if (error) return error

  const guzergahId = request.nextUrl.searchParams.get('guzergahId')?.trim()
  const dilimId = request.nextUrl.searchParams.get('dilimId')?.trim()
  if (!guzergahId || !dilimId) {
    return NextResponse.json({ ok: false, message: 'guzergahId ve dilimId zorunludur.' }, { status: 400 })
  }

  try {
    const sonuc = await acilDurumListesiGetir({ guzergahId, dilimId })

    await acilDurumErisimIziYaz({
      actorId: userId,
      ipAddress: istekIpAdresi(request.headers),
      guzergahId,
      dilimId,
      sonuc,
      erisimTipi: ERISIM_TIPI_GORUNTULEME,
      auditAction: AUDIT_ACTION_GORUNTULEME,
    })

    return NextResponse.json({ ok: true, data: sonuc })
  } catch (err) {
    if (err instanceof AcilDurumListesiError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 })
    }
    console.error('Acil durum servis listesi alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Acil durum listesi alınırken hata oluştu.' }, { status: 500 })
  }
}
