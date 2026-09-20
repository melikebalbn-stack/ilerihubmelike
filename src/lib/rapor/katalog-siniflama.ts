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
