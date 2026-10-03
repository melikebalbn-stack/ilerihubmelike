// Servis atamalarında başlangıç / bitiş / kapatma tarihi kuralları (A3).
//
// Eskiden: `dateOnlyOrNull('abc')` Invalid Date döndürüyor ve doğrulamadan
// geçiyordu; kapatma tarihi için başlangıçtan sonra olmak dışında HİÇBİR sınır
// yoktu (2099-12-31 ile "kapatılan" bir atama aktif=false olurken tarih
// aralığı bugünü kapsamaya devam ediyor, `aktif`'e bakan ve bakmayan okuyucular
// farklı sonuç veriyordu).
//
// Kurallar:
//  1. Tarih geçerli bir takvim günü olmalı (YYYY-MM-DD).
//  2. Makul aralık: MIN_TARIH (2020-01-01) .. bugün + 1 yıl. Yazım hatasını
//     (2062, 1925, 20256-...) yakalar; planlı bitiş için 1 yıllık ufuk yeter.
//  3. Bitiş >= başlangıç.
//  4. KAPATMA (pasifleştirme) tarihi bugünden ileri OLAMAZ: kapatma "bitti"
//     demektir ve aktif=false yazar. İleri tarihli planlı bitiş için atamanın
//     bitiş tarihi düzenlenir (atama o güne kadar aktif kalır).
// "Bugün" Türkiye gününe göre hesaplanır (sunucu UTC olsa da gece yarısı kayması olmasın).

export const MIN_TARIH = '2020-01-01'
export const MAKS_ILERI_YIL = 1

export class TarihHatasi extends Error {}

export function bugunTR(simdi: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(simdi) // YYYY-MM-DD
}

function gunToDate(gun: string): Date {
  return new Date(`${gun}T00:00:00.000Z`)
}

/** Makul aralığın üst sınırı (bugün + 1 yıl, Türkiye günü) — YYYY-MM-DD. */
export function enIleriTarihTR(simdi: Date = new Date()): string {
  const [y, m, d] = bugunTR(simdi).split('-').map(Number)
  // 29 Şubat'tan +1 yıl: JS Date taşmasını önlemek için gün sınırlanır
  const yeniYil = y + MAKS_ILERI_YIL
  const sonGun = new Date(Date.UTC(yeniYil, m, 0)).getUTCDate()
  return `${yeniYil}-${String(m).padStart(2, '0')}-${String(Math.min(d, sonGun)).padStart(2, '0')}`
}

/** YYYY-MM-DD → Date (UTC gün başı). Geçersiz biçim/takvim günü → TarihHatasi. */
export function tarihCoz(deger: string, etiket: string): Date {
  const gun = deger.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gun)) throw new TarihHatasi(`${etiket} geçersiz (GG.AA.YYYY seçin).`)
  const tarih = gunToDate(gun)
  if (Number.isNaN(tarih.getTime()) || tarih.toISOString().slice(0, 10) !== gun) {
    throw new TarihHatasi(`${etiket} geçersiz.`)
  }
  return tarih
}

/** Makul aralık kontrolüyle tarih çözer. */
export function makulTarihCoz(deger: string, etiket: string, simdi: Date = new Date()): Date {
  const tarih = tarihCoz(deger, etiket)
  const gun = deger.trim()
  if (gun < MIN_TARIH) throw new TarihHatasi(`${etiket} ${MIN_TARIH} tarihinden önce olamaz.`)
  const ust = enIleriTarihTR(simdi)
  if (gun > ust) throw new TarihHatasi(`${etiket} bugünden en fazla ${MAKS_ILERI_YIL} yıl sonrası (${ust}) olabilir.`)
  return tarih
}

/** Başlangıç tarihi: zorunlu + makul aralık. */
export function baslangicTarihiCoz(deger: string | null | undefined, simdi: Date = new Date()): Date {
  if (!deger?.trim()) throw new TarihHatasi('Başlangıç tarihi zorunludur.')
  return makulTarihCoz(deger, 'Başlangıç tarihi', simdi)
}

/** Bitiş tarihi: boş = süresiz (null); doluysa makul aralık. */
export function bitisTarihiCoz(deger: string | null | undefined, simdi: Date = new Date()): Date | null {
  if (deger === null || deger === undefined || !deger.trim()) return null
  return makulTarihCoz(deger, 'Bitiş tarihi', simdi)
}

/** Kapatma tarihi: zorunlu, başlangıçtan önce olamaz, bugünden ileri olamaz. */
export function kapatmaTarihiCoz(
  deger: string | null | undefined,
  baslangic: Date,
  simdi: Date = new Date(),
): Date {
  if (!deger?.trim()) throw new TarihHatasi('Kapatma tarihi zorunludur ve geçerli olmalıdır.')
  const tarih = makulTarihCoz(deger, 'Kapatma tarihi', simdi)
  if (tarih < baslangic) throw new TarihHatasi('Kapatma tarihi başlangıç tarihinden önce olamaz.')
  if (deger.trim() > bugunTR(simdi)) {
    throw new TarihHatasi(
      'Kapatma tarihi bugünden ileri olamaz. İleri tarihli planlı bitiş için atamanın bitiş tarihini düzenleyin.',
    )
  }
  return tarih
}

/** Başlangıç <= bitiş (bitiş yoksa geçer). */
export function aralikDogrula(baslangic: Date, bitis: Date | null): void {
  if (bitis && bitis < baslangic) throw new TarihHatasi('Bitiş tarihi başlangıç tarihinden önce olamaz.')
}
