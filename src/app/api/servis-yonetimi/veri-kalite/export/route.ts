import { NextResponse } from 'next/server'
import { requireAllPermissions } from '@/lib/auth/require-permission'
import { veriKaliteRaporuGetir } from '@/lib/servis-yonetimi/veri-kalite'
import {
  veriKaliteExcelDosyaAdi,
  veriKaliteExcelOlustur,
} from '@/lib/servis-yonetimi/veri-kalite-excel'
import { raporSiraliOlustur } from '../_rapor-duzeni'

export const dynamic = 'force-dynamic'

// MASTER Madde 43 — Veri Kalite Merkezi'nin Excel hâli.
//
// YETKİ: servis.view VE servis.export — İKİSİ BİRDEN (requireAllPermissions,
// AND). requirePermission'a dizi vermek OR'dur ve buraya UYMAZ: ekranı
// görebilen herkes dosyayı indirebilmemeli, dışa aktarım ayrı bir eksen.
//
// 🔴 KIRPMA YOK. veriKaliteRaporuGetir() kırpılmamış veri döndürür ve
// _rapor-duzeni.ts de kırpmaz; ekranın KAYIT_LIMIT=200 kırpması yalnız
// ../route.ts'te, sunum için uygulanır. Buraya kirp() EKLEMEYİN — madde 62
// (tam liste) sessizce eksik çıkar. Davranışsal koruma testte:
// "200'den fazla kayıt export'ta kesilmiyor".
//
// AUDIT İZİ YOK (karar): veri yüzeyi ekranla birebir aynı ve audit-log.ts'e
// 'SERVIS' hedef tipini ekleme işi madde 49 dalında duruyor; burada
// tekrarlanırsa birleştirmede çakışır.
export async function GET() {
  const { error } = await requireAllPermissions(['servis.view', 'servis.export'])
  if (error) return error

  try {
    const rapor = await veriKaliteRaporuGetir()
    const buf = veriKaliteExcelOlustur(raporSiraliOlustur(rapor))

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // 🔴 Dosya adı SALT ASCII — Content-Disposition başlığında Türkçe
        // karakter kodlaması bozulur (latin-1 başlık alanı).
        'Content-Disposition': `attachment; filename="${veriKaliteExcelDosyaAdi()}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Veri kalite Excel export hatası:', err)
    return NextResponse.json({ ok: false, message: 'Excel oluşturulurken hata oluştu.' }, { status: 500 })
  }
}
