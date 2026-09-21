import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { veriKaliteRaporuGetir, type VeriKaliteRaporSatiri } from '@/lib/servis-yonetimi/veri-kalite'

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

// MASTER madde 43'ün 14 anomalisinden salt okunur tespiti YAPILAMAYAN
// üçü (8 vardiya, 10 adres, 12 kapasite — bkz. keşif raporu B.8/B.10/F)
// burada "Bu Ay Ne Değişti?" API'sindeki kapsamDisi/not deseniyle
// placeholder olarak döner — hata fırlatmaz, ekran normal bir kart
// olarak render edebilir.
type VeriKaliteKapsamDisiSatiri = {
  kod: string
  baslik: string
  adet: 0
  kayitlar: never[]
  kirpildi: false
  kapsamDisi: true
  not: string
}
type VeriKaliteKirpilmisSatiri = VeriKaliteRaporSatiri & { kirpildi: boolean }
type VeriKaliteApiSatiri = VeriKaliteKirpilmisSatiri | VeriKaliteKapsamDisiSatiri

const VARDIYA_UYUMSUZLUGU: VeriKaliteKapsamDisiSatiri = {
  kod: 'vardiya-uyumsuzlugu',
  baslik: 'Vardiya uyumsuzluğu',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Personnel'de vardiya alanı yok, ServisSeferDilimi.grupKodu IproVardiya'ya kasıtlı olarak bağlı değil — " +
    'güvenilir bir eşleştirme kurulamıyor (bkz. keşif raporu madde B.8).',
}

const ADRES_DEGISMIS: VeriKaliteKapsamDisiSatiri = {
  kod: 'adres-degismis-servis-yeniden-degerlendirilmemis',
  baslik: 'Adres değişmiş / servis yeniden değerlendirilmemiş',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Personnel için izlenebilir bir adres değişikliği kaynağı (audit/tarihçe) yok — madde 31'deki aynı açık " +
    'sorun (bkz. keşif raporu madde B.10).',
}

const KAPASITE_ASIMI: VeriKaliteKapsamDisiSatiri = {
  kod: 'kapasite-asimi',
  baslik: 'Kapasite aşımı',
  adet: 0,
  kayitlar: [],
  kirpildi: false,
  kapsamDisi: true,
  not:
    "Kapasite motoru (servisKapasiteOzetiGetir) henüz main'e girmedi — bu kontrol motor main'e girdiğinde " +
    'eklenecek (TODO, madde 43/12).',
}

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

// Rapor dizisini MASTER'ın 1-14 sırasına göre dizer (kontrat: her kod
// yalnız bir kez, eksik kod = kod/route arasında bozulmuş bir sözleşme —
// bilerek fail-loud, salt tespitin "sessiz hata yutma" prensibinden
// FARKLI: bu bir programlama hatası, veri anomalisi değil).
function raporSiraliOlustur(rapor: VeriKaliteRaporSatiri[]): VeriKaliteApiSatiri[] {
  const byKod = new Map(rapor.map(r => [r.kod, r]))
  const al = (kod: string): VeriKaliteKirpilmisSatiri => {
    const satir = byKod.get(kod)
    if (!satir) throw new Error(`Veri kalite raporunda beklenen kontrol eksik: ${kod}`)
    return kirp(satir)
  }

  return [
    al('aktif-personel-servis-yok'),
    al('pasif-personel-servis-aktif'),
    al('mukerrer-aktif-servis'),
    al('servis-var-arac-yok'),
    al('servis-var-sofor-yok'),
    al('guzergah-sefer-dilimi-tanimsiz'),
    al('kapasitesi-eksik-arac'),
    al('koordinatsiz-durak'),
    VARDIYA_UYUMSUZLUGU,
    al('cakisan-atamalar'),
    ADRES_DEGISMIS,
    al('suresi-bitmis-gecici-atama'),
    KAPASITE_ASIMI,
    al('tarih-cakismasi-arac-sofor'),
    al('aktif-arac-pasif-firma'),
    al('dis-firma-soforu-firmasiz'),
  ]
}

export async function GET() {
  const { error } = await requirePermission('servis.view')
  if (error) return error

  try {
    const rapor = await veriKaliteRaporuGetir()
    return NextResponse.json({ ok: true, data: raporSiraliOlustur(rapor) })
  } catch (err) {
    console.error('Veri kalite raporu alma hatası:', err)
    return NextResponse.json({ ok: false, message: 'Veri kalite raporu alınırken hata oluştu.' }, { status: 500 })
  }
}
