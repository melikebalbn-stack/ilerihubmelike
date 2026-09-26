// MASTER Madde 46/47 — FİRMA SINIRI BEKÇİSİ.
//
// Elif'in kararı: şikâyetçi kimliği İK/İdari İşler'de kalır, TAŞERON FİRMAYA
// ASLA GİTMEZ. Bunun asıl savunması sorgu katmanıdır
// (sikayetFirmaListesiGetir şikâyetçi alanlarını prisma select'ine hiç
// koymaz). Bu dosya İKİNCİ ve SON hattır: sorgu katmanı bir gün yanlışlıkla
// şikâyetçi seçerse, veri firmaya ulaşmadan burada durur.
//
// 🔴 FAIL-CLOSED: sızıntı bulunursa HATA FIRLATILIR. Sessizce göndermek de,
// alanı ayıklayıp devam etmek de YANLIŞTIR:
//   - Sessiz gönderim KVKK ihlalidir.
//   - Ayıklama ikinci bir "hangi alanlar gider" uygulaması olur (sorgu
//     katmanıyla ikiye bölünmüş bir doğruluk kaynağı) ve asıl hatayı —
//     sorgu katmanının yanlış select'ini — GİZLER. Hata görünür olmalı ki
//     kaynağı düzeltilsin.
//
// 🔴 TEK MEKANİZMA: firma görünümü ucu da, 5E'deki Excel/PDF dışa aktarımı
// da BUNU çağırır. İkinci bir kopya yazılmayacak.

/** Şikâyetçiye işaret eden anahtar deseni. Alan adı değişse de yakalar. */
const SIKAYETCI_DESENI = /sikayetci/i

export class FirmaSiniriIhlali extends Error {
  /** Sızıntının bulunduğu yol(lar) — düzeltmenin nereye yapılacağını söyler. */
  readonly yollar: string[]
  constructor(yollar: string[]) {
    super(
      `Firmaya gidecek veride şikâyetçi kimliği bulundu: ${yollar.join(', ')}. ` +
        'Bu veri firmaya gönderilemez — sorgu katmanındaki select düzeltilmeli.',
    )
    this.name = 'FirmaSiniriIhlali'
    this.yollar = yollar
  }
}

/** İç içe nesne/dizilerde şikâyetçi anahtarı arar; bulduğu YOLLARI döner. */
function sizintiYollari(deger: unknown, yol = ''): string[] {
  if (deger === null || typeof deger !== 'object') return []

  if (Array.isArray(deger)) {
    return deger.flatMap((e, i) => sizintiYollari(e, `${yol}[${i}]`))
  }

  const bulunan: string[] = []
  for (const [anahtar, alt] of Object.entries(deger as Record<string, unknown>)) {
    const altYol = yol ? `${yol}.${anahtar}` : anahtar
    if (SIKAYETCI_DESENI.test(anahtar)) {
      bulunan.push(altYol)
      // Anahtar zaten ihlal; içine inmeye gerek yok.
      continue
    }
    bulunan.push(...sizintiYollari(alt, altYol))
  }
  return bulunan
}

/**
 * Firmaya gidecek gövdeyi denetler. Temizse gövdeyi AYNEN döndürür
 * (çağıran zincirleyebilsin), kirliyse `FirmaSiniriIhlali` fırlatır.
 *
 * Gövde ayıklanmaz, değiştirilmez — bkz. dosya başındaki gerekçe.
 */
export function firmaSiniriniDogrula<T>(govde: T): T {
  const yollar = sizintiYollari(govde)
  if (yollar.length > 0) throw new FirmaSiniriIhlali(yollar)
  return govde
}
