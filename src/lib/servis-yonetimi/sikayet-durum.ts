// MASTER Madde 46 — Şikâyet durum makinesi ve alan tutarlılığı doğrulayıcısı.
//
// SAF: prisma client'a, DB'ye, request'e DOKUNMAZ. Yalnız kural taşır; sorgu
// katmanı ve API bunu çağırır (Adım 2/3).
//
// Desen deneme-transitions.ts'ten alındı (rule 6 — ikinci bir mekanizma
// kurulmadı): deny-by-default geçiş matrisi + `Record<Enum, ...>` tip
// anotasyonuyla exhaustiveness guard. FARK: orada geçişi yapanın ROLÜ de
// eksendi (5 rol); burada tek taraf var (servis.sikayet.manage), o yüzden rol
// ekseni YOK — tek değerli bir boyut eklemek gürültü olurdu.
//
// 🔴 Durum birliği elle union olarak YAZILMAZ; prisma'nın ürettiği tipten
// gelir. Elle yazılsaydı enum'a değer eklendiğinde burası sessizce eski
// kalırdı.
import type { ServisSikayetDurumu } from '@/generated/prisma'

/**
 * GEÇİŞ MATRİSİ — deny-by-default: yalnız burada AÇIKÇA yazılan (from → to)
 * çifti geçerlidir, matriste olmayan her geçiş reddedilir. Terminal durum
 * boş dizi ile İŞARETLENİR (bu makinede terminal durum yok — hatalı kapanış
 * ve hatalı ret geri alınabilmeli).
 *
 * 🔴 EXHAUSTIVENESS GUARD: tip `Record<ServisSikayetDurumu, ...>` olduğu için
 * enum'a yeni bir değer eklendiğinde bu nesne DERLENMEZ —
 * "Property 'YENI_DEGER' is missing in type ... but required in type
 * 'Record<ServisSikayetDurumu, ServisSikayetDurumu[]>'". Hedefler de
 * ServisSikayetDurumu[] olduğu için geçersiz bir hedef yazmak da derleme
 * hatasıdır. Yani matris güncellemesi UNUTULAMAZ.
 *
 * 🔴 ACIK → KAPANDI YOK: bir şikâyet kapanıyorsa ne yapıldığı yazılmış
 * olmalı. Aksiyonsuz kapanış isteniyorsa doğru değer REDDEDILDI'dir. Bu kural
 * madde 47'nin "aksiyon süresi" KPI'sını boşluksuz tutar — her KAPANDI
 * kaydının mutlaka bir aksiyonTarihi olur.
 */
export const SIKAYET_GECISLERI: Record<ServisSikayetDurumu, ServisSikayetDurumu[]> = {
  ACIK: ['AKSIYON_ALINDI', 'REDDEDILDI'],
  AKSIYON_ALINDI: ['KAPANDI', 'REDDEDILDI'],
  // Hatalı/erken kapanış geri alınabilir.
  KAPANDI: ['ACIK'],
  // Hatalı ret geri alınabilir.
  REDDEDILDI: ['ACIK'],
}

/** (from → to) çifti matriste açıkça izinli mi. Deny-by-default. */
export function gecisIzinli(from: ServisSikayetDurumu, to: ServisSikayetDurumu): boolean {
  return SIKAYET_GECISLERI[from].includes(to)
}

/** Bir durumdan gidilebilecek hedefler (ekranda buton listesi için). */
export function izinliHedefler(from: ServisSikayetDurumu): ServisSikayetDurumu[] {
  return [...SIKAYET_GECISLERI[from]]
}

/** Hiçbir çıkışı olmayan durum. Bu makinede yok; kural yine de ifade edilsin. */
export function terminalMi(durum: ServisSikayetDurumu): boolean {
  return SIKAYET_GECISLERI[durum].length === 0
}

/** Ekranda/hata metinlerinde kullanılacak insan okunur adlar. */
export const SIKAYET_DURUM_ETIKETLERI: Record<ServisSikayetDurumu, string> = {
  ACIK: 'Açık',
  AKSIYON_ALINDI: 'Aksiyon alındı',
  KAPANDI: 'Kapandı',
  REDDEDILDI: 'Reddedildi',
}

// ----------------------------------------------------------------------------
// Alan tutarlılığı
// ----------------------------------------------------------------------------

/**
 * Doğrulayıcının baktığı alanlar. ServisSikayet'in TAMAMI değil — yalnız
 * duruma bağlı olanlar; böylece çağıran taraf (Adım 2) henüz kaydedilmemiş
 * bir taslağı da doğrulayabilir.
 */
export interface SikayetDurumAlanlari {
  durum: ServisSikayetDurumu
  aksiyon?: string | null
  aksiyonTarihi?: Date | null
  kapanisTarihi?: Date | null
  kapanisNotu?: string | null
}

export interface DogrulamaSonucu {
  gecerli: boolean
  /** Kullanıcıya gösterilecek, NE YAPILACAĞINI söyleyen mesajlar. */
  hatalar: string[]
}

function dolu(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Durum ile tarih/metin alanlarının tutarlılığı. Prisma bu kuralları ifade
 * edemediği için uygulama katmanı zorlar (şema yorumunun dediği gibi).
 *
 * 🔴 `ACIK` değişmezi YALNIZ `kapanisTarihi IS NULL`'dır — aksiyonTarihi'nı
 * KAPSAMAZ. Yeniden açılmış bir kayıt önceki aksiyon tarihini taşımaya devam
 * eder, yani "ACIK + aksiyonTarihi DOLU" GEÇERLİ bir birleşimdir.
 *
 * Hata mesajları "geçersiz durum" demez; eksik olan alanı ve ne yapılması
 * gerektiğini söyler.
 */
export function durumAlanlariniDogrula(kayit: SikayetDurumAlanlari): DogrulamaSonucu {
  const hatalar: string[] = []
  const etiket = SIKAYET_DURUM_ETIKETLERI[kayit.durum]

  switch (kayit.durum) {
    case 'ACIK':
      // aksiyon/aksiyonTarihi BİLEREK kontrol edilmiyor — yeniden açılan
      // kayıt onları taşır.
      if (kayit.kapanisTarihi) {
        hatalar.push(
          `Şikâyet "${etiket}" durumundayken kapanış tarihi taşıyamaz. Kaydı yeniden açıyorsanız kapanış tarihini temizleyin.`,
        )
      }
      break

    case 'AKSIYON_ALINDI':
      if (!dolu(kayit.aksiyon)) {
        hatalar.push('Aksiyon alındı olarak işaretlemek için ne yapıldığını "Aksiyon" alanına yazın.')
      }
      if (!kayit.aksiyonTarihi) {
        hatalar.push('Aksiyon alındı olarak işaretlemek için aksiyonun alındığı tarihi girin.')
      }
      if (kayit.kapanisTarihi) {
        hatalar.push(
          `Şikâyet "${etiket}" durumundayken kapanış tarihi taşıyamaz. Kayıt çözüldüyse durumu "${SIKAYET_DURUM_ETIKETLERI.KAPANDI}" yapın.`,
        )
      }
      break

    case 'KAPANDI':
      if (!kayit.kapanisTarihi) {
        hatalar.push('Şikâyeti kapatmak için kapanış tarihini girin.')
      }
      break

    case 'REDDEDILDI':
      if (!kayit.kapanisTarihi) {
        hatalar.push('Şikâyeti reddetmek için kapanış tarihini girin.')
      }
      // Ret gerekçesi ZORUNLU: madde 47'de reddedilen şikâyet firma
      // performansına sayılmıyor, bu yüzden neden reddedildiği yazılı olmalı.
      if (!dolu(kayit.kapanisNotu)) {
        hatalar.push('Şikâyeti reddetmek için ret gerekçesini "Kapanış notu" alanına yazın.')
      }
      break
  }

  return { gecerli: hatalar.length === 0, hatalar }
}

// ----------------------------------------------------------------------------
// Yeniden açılma
// ----------------------------------------------------------------------------

/** Yeniden açılırken alanlara uygulanacak yama. Sadece DEĞİŞENLER döner. */
export interface YenidenAcmaYamasi {
  kapanisTarihi: null
  kapanisNotu: null
}

/**
 * KAPANDI/REDDEDILDI → ACIK geçişinde alanlara uygulanacak yama.
 *
 * TEMİZLENİR:
 *   kapanisTarihi — kayıt artık kapalı değil; kalsaydı ACIK değişmezini
 *     ihlal ederdi.
 *   kapanisNotu   — 🔴 KARARIM, gerekçesiyle: bu alan kapanışın/reddin
 *     GEREKÇESİDİR, bağımsız bir olay kaydı değildir. Kapanış geri alınınca
 *     gerekçe de geçersizleşir; bırakılsaydı "açık ama reddedilme gerekçesi
 *     dolu" gibi kendi içinde çelişen bir kayıt oluşur ve bir sonraki
 *     REDDEDILDI'de doğrulayıcı eski metni yeni gerekçe sanardı (kullanıcı
 *     gerekçe yazmayı atlar, doğrulama yine de geçer). Tarihsel iz
 *     kaybolmaz: ServisIslemGecmisi önceki/yeni değeri zaten saklıyor.
 *
 * 🔴 KORUNUR (yamada YER ALMAZ):
 *   aksiyonTarihi ve aksiyon — ilk aksiyonun ne zaman/nasıl alındığı
 *     TARİHSEL BİR OLGUDUR; kapanışı geri almak onu yok etmez. Madde 47'nin
 *     "aksiyon süresi" KPI'sı da bu olguya dayanır. Bu yüzden
 *     "ACIK + aksiyonTarihi DOLU" geçerli bir birleşimdir ve yalnız yeniden
 *     açılmış bir kaydı ifade eder.
 */
export function yenidenAcmaYamasi(): YenidenAcmaYamasi {
  return { kapanisTarihi: null, kapanisNotu: null }
}

/** Bu geçiş bir "yeniden açma" mı (kapalı bir durumdan ACIK'a dönüş). */
export function yenidenAcmaMi(from: ServisSikayetDurumu, to: ServisSikayetDurumu): boolean {
  return to === 'ACIK' && (from === 'KAPANDI' || from === 'REDDEDILDI')
}

/**
 * Geçişi tek adımda hesaplar: izin kontrolü + yeniden açma yaması +
 * sonuçtaki alanların tutarlılık kontrolü. Çağıran taraf (Adım 2) yalnız
 * bunu kullanır, kuralları tekrar etmez.
 */
export function gecisiUygula(
  mevcut: SikayetDurumAlanlari,
  hedef: ServisSikayetDurumu,
  degisiklikler: Partial<Omit<SikayetDurumAlanlari, 'durum'>> = {},
): { gecerli: boolean; hatalar: string[]; sonuc: SikayetDurumAlanlari } {
  const from = mevcut.durum

  if (!gecisIzinli(from, hedef)) {
    const hedefler = izinliHedefler(from)
    const liste = hedefler.map(h => SIKAYET_DURUM_ETIKETLERI[h]).join(', ')
    return {
      gecerli: false,
      hatalar: [
        `"${SIKAYET_DURUM_ETIKETLERI[from]}" durumundaki bir şikâyet doğrudan ` +
          `"${SIKAYET_DURUM_ETIKETLERI[hedef]}" yapılamaz. Buradan geçebileceğiniz durumlar: ${liste}.` +
          (from === 'ACIK' && hedef === 'KAPANDI'
            ? ' Kapatmadan önce ne yapıldığını "Aksiyon alındı" adımında kaydedin; işlem gerektirmiyorsa "Reddedildi" kullanın.'
            : ''),
      ],
      sonuc: mevcut,
    }
  }

  const sonuc: SikayetDurumAlanlari = {
    ...mevcut,
    ...degisiklikler,
    durum: hedef,
    ...(yenidenAcmaMi(from, hedef) ? yenidenAcmaYamasi() : {}),
  }

  const { gecerli, hatalar } = durumAlanlariniDogrula(sonuc)
  return { gecerli, hatalar, sonuc }
}
