/**
 * Katalog entity sınıflaması — istemci ve sunucuda ortak, saf.
 *
 * Bulgu (20.09, 1167 entity): IFS'te "Reference_" öneki EntityType'ta değil EntitySet adında
 * (Reference_ShopOrd, Reference_UserAllowedSiteLov). Tip düzeyinde referans/lookup'ı işaret eden
 * ekler: *Lov, *Lov1..9 (285), *Virtual (83 — ekran/diyalog sanal varlıkları, veri tablosu değil),
 * *Query (3), *Uiv (2). Dop* (DOP sipariş işleme: DopOrder, DopHead) ve Qman* (kalite kontrol planı)
 * GERÇEK iş tablolarıdır — referans sayılmaz; yalnız Qman*Lov gibi ekli olanlar kurala takılır.
 */
const REFERANS_EK = /(Lov\d*|Virtual|Query|Uiv)$/

/** Entity adı (ve biliniyorsa EntitySet adları) referans/lookup tablosuna mı işaret ediyor? */
export function referansMi(entity: string, entitySetleri?: string[]): boolean {
  if (REFERANS_EK.test(entity)) return true
  if (entitySetleri?.length && entitySetleri.every((s) => s.startsWith('Reference_'))) return true
  return false
}

/**
 * Birleştirme anahtarı OLAMAYACAK alanlar: her IFS tablosunda bulunan site/şirket kolonları.
 * Bunlar üzerinden birleştirme satır patlamasına yol açar (kartezyene yakın), ilişki değildir —
 * site zaten kaynak filtresiyle (Contract eq '…') sınırlanır.
 */
const ANAHTAR_OLMAZ = new Set(['contract', 'company', 'site', 'siteid', 'companyid'])
export function birlestirmeAnahtariMi(alan: string): boolean {
  return !ANAHTAR_OLMAZ.has(alan.toLocaleLowerCase('tr-TR'))
}

/**
 * İki alan adı aynı anahtarı gösteriyor mu: tam eşitlik ya da biri diğerinin soneki
 * (CustomerOrderNo ↔ OrderNo). Çok kısa adlar (No, Id) gürültü yapmasın diye elenir.
 * Hem sunucudaki alan önerisi hem de veri seti ekranındaki otomatik birleştirme bunu kullanır.
 */
const MIN_ANAHTAR_UZUNLUK = 5
export function adlarEslesir(a: string, b: string): boolean {
  const x = a.toLocaleLowerCase('tr-TR'), y = b.toLocaleLowerCase('tr-TR')
  if (x.length < MIN_ANAHTAR_UZUNLUK || y.length < MIN_ANAHTAR_UZUNLUK) return false
  return x === y || x.endsWith(y) || y.endsWith(x)
}

/**
 * Hedef entity'nin anahtarı için veri setindeki EN İYİ eşleşme.
 *
 * Yalnız ad eşitliğine bakmak yanıltıyor: ShopOrd.OrderNo (iş emri no) ile CustomerOrder.OrderNo
 * (müşteri sipariş no) adaş ama ilişkili DEĞİL; doğrusu ShopOrd.CustomerOrderNo ↔ CustomerOrder.OrderNo.
 * Bu yüzden adı hedef entity'yi İÇEREN alan (CustomerOrderNo ⊃ CustomerOrder) tam eşitlikten önde gelir.
 */
export function enIyiAnahtarEslesmesi<T extends { alan: string }>(mevcut: T[], anahtar: string, entity: string): T | undefined {
  const a = anahtar.toLocaleLowerCase('tr-TR')
  const e = entity.toLocaleLowerCase('tr-TR')
  let enIyi: { kayit: T; puan: number } | undefined
  for (const m of mevcut) {
    if (!adlarEslesir(m.alan, anahtar)) continue
    const ad = m.alan.toLocaleLowerCase('tr-TR')
    const puan = (ad.includes(e) && ad !== a ? 3 : 0) + (ad === a ? 2 : 1)
    if (!enIyi || puan > enIyi.puan) enIyi = { kayit: m, puan }
  }
  return enIyi?.kayit
}
