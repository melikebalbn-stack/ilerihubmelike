import { NextRequest, NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { sikayetFiltresiCoz, sikayetFirmaListesiGetir } from '@/lib/servis-yonetimi/sikayet'
import { firmaSiniriniDogrula, FirmaSiniriIhlali } from '@/lib/servis-yonetimi/sikayet-firma-siniri'
import { gorunumXlsx } from '@/lib/rapor/gorunum-xlsx'
import {
  sikayetExcelDosyaAdi,
  sikayetExcelSatirlari,
  SIKAYET_EXPORT_ALT_BASLIGI,
  SIKAYET_EXPORT_BASLIGI,
  SIKAYET_EXPORT_GORUNUMU,
} from '@/lib/servis-yonetimi/sikayet-excel'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// MASTER Madde 47 — şikâyet/firma performansının Excel hâli (Adım 5F).
//
// YETKİ: servis.sikayet.view VE servis.export — İKİSİ BİRDEN
// (requireAllPermissions, AND · madde 62 deseni). requirePermission'a dizi
// vermek OR'dur ve buraya UYMAZ: ekranı görebilen herkes dosyayı
// indirebilmemeli, dışa aktarım ayrı bir eksendir.
//
// 🔴 VIEW ANAHTARI `servis.view` DEĞİL `servis.sikayet.view`: rol eşlemesinde
// (seed-servis-role-mapping.ts) `admin` rolünde servis.view + servis.export
// VAR ama servis.sikayet.view YOK. `servis.view` kullanılsaydı admin, ekranda
// göremediği (GET /sikayet → 403) şikâyet verisini dosya olarak
// İNDİREBİLİRDİ. Dışa aktarım ekrandan GENİŞ olamaz — fail-closed.
// Sonuç: dosyayı indirebilen roller super-admin ve hr-yoneticisi.
//
// 🔴 KIRPMA YOK (madde 62): sikayetFirmaListesiGetir `take` almaz,
// sikayet-excel.ts de kesmez. Davranışsal koruma testte:
// "200'den fazla kayıt export'ta kesilmiyor".
//
// 🔴 Firma sınırı bekçisi: aynı tek mekanizma (sikayet-firma-siniri.ts),
// firma görünümü ucuyla PAYLAŞILIR — ikinci kopya yok. Veri dosyaya
// dönüşmeden ÖNCE geçer.
export async function GET(request: NextRequest) {
  const { error } = await requireAllPermissions(['servis.sikayet.view', 'servis.export'])
  if (error) return error

  try {
    // Filtreler ekranla AYNI ayrıştırıcıdan — dosya ekranda görülenin
    // tamamıdır, başka bir süzgeç uygulanmaz.
    const kayitlar = await sikayetFirmaListesiGetir(sikayetFiltresiCoz(request.nextUrl.searchParams))

    // 🔴 Bekçi, satırlar dosyaya çevrilmeden önce ve HAM kayıtlar üzerinde
    // çalışır: dönüşüm bir alanı yeniden adlandırıp sızıntıyı gizleyebilirdi.
    firmaSiniriniDogrula(kayitlar)

    const buffer = await gorunumXlsx(
      SIKAYET_EXPORT_BASLIGI,
      sikayetExcelSatirlari(kayitlar),
      SIKAYET_EXPORT_GORUNUMU,
      { altBaslik: SIKAYET_EXPORT_ALT_BASLIGI },
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${sikayetExcelDosyaAdi()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof FirmaSiniriIhlali) {
      // Gövde GÖNDERİLMEZ. Ayrıntı yalnız sunucu loguna; yanıt nötr
      // (firma görünümü ucuyla aynı davranış).
      console.error('[firma-siniri] KVKK sızıntısı engellendi (export):', err.yollar)
      return NextResponse.json(
        { ok: false, message: 'Dışa aktarım üretilemedi (veri sınırı ihlali).' },
        { status: 500 },
      )
    }
    console.error('Şikâyet Excel export hatası:', err)
    return NextResponse.json({ ok: false, message: 'Excel oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
