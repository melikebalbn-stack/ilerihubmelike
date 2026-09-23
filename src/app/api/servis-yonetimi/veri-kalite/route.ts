import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { veriKaliteRaporuGetir, type VeriKaliteRaporSatiri } from '@/lib/servis-yonetimi/veri-kalite'
import { raporSiraliOlustur } from './_rapor-duzeni'

// Yanıt boyutu sınırı — FAZ 1C göçü henüz koşulmadığı için şu an hiçbir
// personelin servis ataması yok; bu durumda madde 1 tek başına ~1400 satır
// dönebilir. Mevcut en büyük GERÇEK hacim madde 7 (106 durak, 2026-09-21
// doğrulaması) — 200, bu hacmin ~2 katı bir tampon payıyla hem bugünkü
// gerçek verileri kırpmadan geçirir hem de göç sonrası olası ~1400 satırlık
// senaryoyu kontrol altına alır. Tam liste ihtiyacı ayrı Veri Kalite Excel
// export maddesiyle karşılanacak — bu kırpma bilgi kaybı değildir, `adet`
// alanı her zaman kırpılmamış gerçek toplamı taşır.
// route.ts (Next.js Route Handler) yalnız HTTP metodu ve rota segmenti
// config export'larını kabul eder — bu yüzden bu sabit EXPORT EDİLMEZ,
// modül içinde tek yerde tanımlı kalır (test dosyası aynı değeri ayrıca
// tanımlar, bkz. route.test.ts).
const KAYIT_LIMIT = 200

type VeriKaliteKirpilmisSatiri = VeriKaliteRaporSatiri & { kirpildi: boolean }

// adet HER ZAMAN kırpılmamış gerçek toplamı taşır (veri-kalite.ts'ten
// olduğu gibi geçer) — yalnız kayitlar dizisi KAYIT_LIMIT'e kırpılır.
function kirp(satir: VeriKaliteRaporSatiri): VeriKaliteKirpilmisSatiri {
  const kirpildi = satir.kayitlar.length > KAYIT_LIMIT
  return {
    ...satir,
    kayitlar: kirpildi ? satir.kayitlar.slice(0, KAYIT_LIMIT) : satir.kayitlar,
    kirpildi,
  }
}

export async function GET() {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  try {
    const rapor = await veriKaliteRaporuGetir()
    // Sıralama/yer tutucular ortak dosyada (kırpmasız); KAYIT_LIMIT kırpması
    // EKRANA ÖZGÜ olduğu için burada, düzenin ÇIKTISI üzerinde uygulanır.
    // Yer tutucular kirp()'ten GEÇMEZ — eskiden de geçmiyordu (al() yalnız
    // gerçek kontrolleri sarıyordu), çıktı birebir korunur.
    const data = raporSiraliOlustur(rapor).map(s =>
      'kapsamDisi' in s ? s : kirp(s),
    )
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Veri kalite raporu alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Veri kalite raporu alınırken hata oluştu.' }, { status: 500 })
  }
}
