import { NextRequest, NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { sikayetFiltresiCoz, sikayetFirmaListesiGetir } from '@/lib/servis-yonetimi/sikayet'
import { firmaSiniriniDogrula, FirmaSiniriIhlali } from '@/lib/servis-yonetimi/sikayet-firma-siniri'
import {
  sikayetExcelSatirlari,
  SIKAYET_EXPORT_ALT_BASLIGI,
  SIKAYET_EXPORT_BASLIGI,
} from '@/lib/servis-yonetimi/sikayet-excel'
import {
  generateSikayetFirmaRaporuPdfBuffer,
  sikayetPdfDosyaAdi,
} from '@/lib/pdf/sikayet-firma-raporu-pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// MASTER Madde 47 — şikâyet/firma performansının PDF hâli (Adım 5G).
//
// 🔴 Excel ucunun (../route.ts) İKİZİ: aynı yetki, aynı filtre ayrıştırıcı,
// aynı sorgu, aynı bekçi, aynı satır dönüşümü. Tek fark son adımda biçim
// üreticisi. İki uç arasında veri farkı OLUŞAMAZ — kolon tanımı da tek
// kaynaktan (SIKAYET_EXPORT_KOLONLARI) gelir.
//
// YETKİ: servis.sikayet.view VE servis.export (AND). servis.view DEĞİL:
// admin rolünde servis.view+servis.export var, servis.sikayet.view yok;
// dışa aktarım ekranda görülebilenden geniş olamaz.
//
// 🔴 KIRPMA YOK · bekçi HAM kayıtlar üzerinde, dönüşümden ÖNCE.
export async function GET(request: NextRequest) {
  const { error } = await requireAllPermissions(['servis.sikayet.view', 'servis.export'])
  if (error) return error

  try {
    const kayitlar = await sikayetFirmaListesiGetir(sikayetFiltresiCoz(request.nextUrl.searchParams))

    firmaSiniriniDogrula(kayitlar)

    const buffer = generateSikayetFirmaRaporuPdfBuffer({
      baslik: SIKAYET_EXPORT_BASLIGI,
      altBaslik: SIKAYET_EXPORT_ALT_BASLIGI,
      satirlar: sikayetExcelSatirlari(kayitlar),
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sikayetPdfDosyaAdi()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof FirmaSiniriIhlali) {
      console.error('[firma-siniri] KVKK sızıntısı engellendi (pdf):', err.yollar)
      return NextResponse.json(
        { ok: false, message: 'Dışa aktarım üretilemedi (veri sınırı ihlali).' },
        { status: 500 },
      )
    }
    console.error('Şikâyet PDF export hatası:', err)
    return NextResponse.json({ ok: false, message: 'PDF oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
