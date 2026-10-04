import { makulTarihCoz, TarihHatasi, bugunTR } from './tarih-kurallari'

// ============================================================================
// ATAMA GEÇİŞİ (transfer / güzergâh-durak değişikliği) — TEK YARDIMCI (C5)
// ============================================================================
//
// Transfer (service.ts) ve Excel toplu atamadaki "güzergâh/durak değişikliği" satırı AYNI kuralla çalışır:
//
//  • Geçiş günü G (A3 kuralları: geçerli takvim günü, 2020-01-01 .. bugün+1 yıl; eski atamanın
//    başlangıcından önce olamaz). Varsayılan bugün (ekran).
//  • G bugün ya da geçmişse: eski atama HEMEN pasife alınır (bitiş = G), yeni atama G'de başlar.
//  • G İLERİ tarihliyse: eski atama G'ye kadar AKTİF kalır (bitiş yazılır), yeni atama G'de başlar.
//    Eskiden ileri tarihli transferde eski atama hemen pasife alınıyordu (kusur): personel G'ye kadar
//    kapasitede/listede hiçbir yerde görünmüyordu.
//
// 🔴 DB KISITI: servis_personel_atama_aktif_tarih_excl, aynı personelin AKTİF atamalarında
// daterange(baslangic, COALESCE(bitis,'infinity'), '[]') — KAPALI aralık — çakışmasını yasaklar. Bu yüzden eski
// atama aktif kalacaksa bitişi G'nin BİR GÜN ÖNCESİ yazılır (bitiş = G olsaydı G gününde yeni atamayla
// çakışır ve DB reddederdi). Eski atama hemen pasife alınıyorsa (aktif=false) kısıt uygulanmaz; bitiş = G.
// ============================================================================

export type GecisPlani = {
  /** YYYY-MM-DD */
  gecisGunu: string
  /** Yeni atamanın başlangıcı. */
  yeniBaslangic: Date
  /** Eski atamaya yazılacak bitiş tarihi. */
  eskiBitis: Date
  /** false → eski atama şimdi pasife alınır; true → geçiş gününe kadar aktif kalır (planlı kapanış). */
  eskiAktif: boolean
  /** Yeni atama bugünün kapasitesine giriyor mu (yalnız başlamış olanlar sayılır — C0). */
  yeniBugunKapsar: boolean
}

const gun = (d: Date) => d.toISOString().slice(0, 10)

export function gecisPlanla(
  eskiBaslangic: Date,
  gecisGunu: string | null | undefined,
  etiket: string,
  simdi: Date = new Date(),
): GecisPlani {
  if (!gecisGunu?.trim()) throw new TarihHatasi(`${etiket} zorunludur ve geçerli olmalıdır.`)
  const gecis = makulTarihCoz(gecisGunu, etiket, simdi)
  if (gecis < eskiBaslangic) throw new TarihHatasi(`${etiket}, eski atamanın başlangıç tarihinden önce olamaz.`)

  const g = gun(gecis)
  const bugun = bugunTR(simdi)
  const ileri = g > bugun
  // Eski atama hiç başlamadıysa (geçiş günü = başlangıç) aralık oluşamaz → hemen pasif, bitiş = başlangıç.
  const eskiAktif = ileri && gecis > eskiBaslangic
  const eskiBitis = eskiAktif ? new Date(gecis.getTime() - 24 * 60 * 60 * 1000) : gecis
  return { gecisGunu: g, yeniBaslangic: gecis, eskiBitis, eskiAktif, yeniBugunKapsar: !ileri }
}
