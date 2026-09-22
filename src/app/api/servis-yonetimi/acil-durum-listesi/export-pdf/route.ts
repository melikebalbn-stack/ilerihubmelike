import { NextRequest, NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { acilDurumListesiGetir, AcilDurumListesiError } from '@/lib/servis-yonetimi/acil-durum-listesi'
import { generateAcilDurumListesiPdfBuffer } from '@/lib/pdf/acil-durum-listesi-pdf'
import {
  acilDurumErisimIziYaz,
  istekIpAdresi,
  AUDIT_ACTION_PDF,
  ERISIM_TIPI_PDF,
} from '../_erisim-izi'

export const dynamic = 'force-dynamic'

// MASTER Madde 49 — acil durum listesinin taşınabilir (PDF) hali.
//
// YETKİ ekranla AYNI: servis.view VE servis.kvkk.view. servis.export
// KULLANILMAZ — bu bir "dışa aktarma yetkisi" değil, AYNI KVKK verisinin
// taşınabilir hali; ekranı göremeyen dosyasını da alamamalı.
//
// Erişim izi ekranla aynı mekanizmadan geçer (_erisim-izi.ts) ama AYRI
// accessType/action ile: taşınabilir kopya sistemden çıkıyor, denetimde
// görüntülemeden ayrışmalı.
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
    const buf = generateAcilDurumListesiPdfBuffer(sonuc)

    await acilDurumErisimIziYaz({
      actorId: userId,
      ipAddress: istekIpAdresi(request.headers),
      guzergahId,
      dilimId,
      sonuc,
      erisimTipi: ERISIM_TIPI_PDF,
      auditAction: AUDIT_ACTION_PDF,
    })

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Acil-Durum-Listesi-${sonuc.guzergah.kod}-${sonuc.dilim.kod}-${sonuc.tarih}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof AcilDurumListesiError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 404 })
    }
    console.error('Acil durum listesi PDF hatası:', err)
    return NextResponse.json({ ok: false, message: 'PDF oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
