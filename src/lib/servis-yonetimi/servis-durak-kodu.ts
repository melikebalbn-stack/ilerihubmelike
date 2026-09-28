/**
 * Servis durak kodu — KANONİK ŞEMA, TEK KAYNAK.
 *
 * `<güzergâh kodu>-<sıra, 2 hane>` · örn. `ARAPCESME-01`
 *
 * 🔴 Melih'in kuralı: tanım paketi (prisma/seed-servis-tanim.ts) ve göç
 * script'i (docs/servis-yonetimi/goc-personnel-servis-atama.ts) durak kodunu
 * AYNI fonksiyondan üretir. İki ayrı şema olmayacak.
 *
 * 🔴 BİRLEŞTİRME NOTU (Melih'e): bugün `durakKodu`'nun bir kopyası
 * `feat/servis-goc-script` dalındaki src/lib/servis-yonetimi/goc-siniflandirma.ts
 * içinde de duruyor. O dosya main'de YOK, bu yüzden bu dal ondan import
 * edemedi. İki dal main'e girdiğinde goc-siniflandirma.ts'teki kopya
 * SİLİNMELİ ve buradan import edilmelidir — aksi halde tam kaçındığımız
 * "iki şema" durumu kod seviyesinde doğar.
 *
 * Neden ada bağlı DEĞİL: durak adı değişebilir (Elif'in gereksinimi:
 * "servis adları kod gerekmeden düzenlenebilmeli"). Kod sıra numarasına
 * dayanır, ad değişince kod sabit kalır.
 */
export function durakKodu(guzergahKod: string, sira: number): string {
  return `${guzergahKod}-${String(sira).padStart(2, '0')}`
}
