// Kadro (personel) talebi — "Pozisyon Adı" seçim DURUMU ve kayda yazılacak alanlar.
//
// Saf modül: hem form (client) hem uçlar (server) buradan beslenir; "şemadan mı
// seçildi, elle mi yazıldı" kararı TEK yerde kalsın. React/DB bağımlılığı yok.

import type { PozisyonSecenek } from './pozisyon-secenekleri'

/** Açılır listedeki "Yeni pozisyon ekle" satırının sahte kodu (gerçek kutu kodu olamaz). */
export const POZISYON_ELLE = '__elle__'

export type PozisyonSecim = {
  /** Org kutu kodu, POZISYON_ELLE ya da '' (seçim yok). */
  kod: string
  /** Gösterilecek/kaydedilecek unvan. Elle modda talep edenin yazdığı metin. */
  unvan: string
}

export const POZISYON_SECIM_BOS: PozisyonSecim = { kod: '', unvan: '' }

export function elleModdaMi(secim: PozisyonSecim): boolean {
  return secim.kod === POZISYON_ELLE
}

/**
 * AramaliSecim'e verilecek seçenek listesi. "Yeni pozisyon ekle" satırı DAİMA en
 * sonda ve liste boş olsa bile durur (bölümün şema bağı olmadığı hâlde elle yazma
 * yolunun açık kalması şart).
 */
export function pozisyonSecenekListesi(
  secenekler: PozisyonSecenek[],
): { id: string; etiket: string; aramaEk?: (string | null | undefined)[] }[] {
  return [
    ...secenekler.map((s) => ({ id: s.kod, etiket: s.ad, aramaEk: [s.kod] })),
    { id: POZISYON_ELLE, etiket: '+ Yeni pozisyon ekle (şemada yok)' },
  ]
}

/** Listeden bir satır seçildi. Elle moda geçişte önceden yazılmış metin korunur. */
export function pozisyonSecimDegisti(
  kod: string,
  secenekler: PozisyonSecenek[],
  mevcut: PozisyonSecim,
): PozisyonSecim {
  if (kod === POZISYON_ELLE) {
    return { kod: POZISYON_ELLE, unvan: elleModdaMi(mevcut) ? mevcut.unvan : '' }
  }
  const bulunan = secenekler.find((s) => s.kod === kod)
  if (!bulunan) return POZISYON_SECIM_BOS
  return { kod: bulunan.kod, unvan: bulunan.ad }
}

/** Elle yazma alanına yazıldı. Elle modda değilse yoksayılır (durum bozulmasın). */
export function pozisyonElleYazildi(metin: string, mevcut: PozisyonSecim): PozisyonSecim {
  if (!elleModdaMi(mevcut)) return mevcut
  return { kod: POZISYON_ELLE, unvan: metin }
}

/**
 * BÖLÜM DEĞİŞTİ: yeni bölümün listesinde karşılığı kalmayan seçim TEMİZLENİR.
 * Elle yazılan unvan bölüme bağlı değildir — korunur (yeniden yazdırmak kayıp olur).
 * Unvan aynı kalsa bile kod yeni bölümde yoksa seçim geçersizdir: aynı unvanın
 * başka bölümdeki kutusu BAŞKA koddur, yanlış kod saklamaktansa temizlenir.
 */
export function bolumDegistiPozisyon(
  mevcut: PozisyonSecim,
  yeniSecenekler: PozisyonSecenek[],
): PozisyonSecim {
  if (!mevcut.kod) return POZISYON_SECIM_BOS
  if (elleModdaMi(mevcut)) return mevcut
  const bulunan = yeniSecenekler.find((s) => s.kod === mevcut.kod)
  if (!bulunan) return POZISYON_SECIM_BOS
  // Şema arada yeniden adlandırılmışsa unvan güncel kutudan alınır.
  return { kod: bulunan.kod, unvan: bulunan.ad }
}

/** Kaydet düğmesi için: unvan boşsa (elle modda boş metin dahil) geçersiz. */
export function pozisyonSecimGecerliMi(secim: PozisyonSecim): boolean {
  return secim.kod !== '' && secim.unvan.trim() !== ''
}

export type PozisyonKayitAlanlari = {
  title: string
  pozisyonOrgKodu: string | null
  pozisyonSemadaYok: boolean
}

/** POST/PUT gövdesine yazılacak üç alan. Geçersiz seçimde unvan boş döner (uç 400'ler). */
export function pozisyonKayitAlanlari(secim: PozisyonSecim): PozisyonKayitAlanlari {
  const unvan = secim.unvan.trim()
  if (elleModdaMi(secim)) return { title: unvan, pozisyonOrgKodu: null, pozisyonSemadaYok: true }
  if (!secim.kod) return { title: unvan, pozisyonOrgKodu: null, pozisyonSemadaYok: false }
  return { title: unvan, pozisyonOrgKodu: secim.kod, pozisyonSemadaYok: false }
}

export type PozisyonKaynak = 'SEMA' | 'ELLE' | 'ESKI'

/**
 * Kayıttan hangi yolun kullanıldığı. 07.10 öncesi kayıtlarda iki alan da boştur →
 * 'ESKI' (yanlışlıkla "şemadan seçildi" denmez; backfill yapılmadı).
 */
export function pozisyonKaynagi(kayit: {
  pozisyonOrgKodu?: string | null
  pozisyonSemadaYok?: boolean | null
}): PozisyonKaynak {
  if (kayit.pozisyonSemadaYok) return 'ELLE'
  if (kayit.pozisyonOrgKodu) return 'SEMA'
  return 'ESKI'
}

/**
 * İV karar ekranındaki işaret. 'ESKI' kayıtlarda null → ekranda hiçbir şey çıkmaz
 * (eski taleplere "şemada yok" damgası vurmak yanlış bilgi olurdu).
 */
export function pozisyonKaynagiEtiketi(kayit: {
  pozisyonOrgKodu?: string | null
  pozisyonSemadaYok?: boolean | null
}): { tur: PozisyonKaynak; etiket: string; aciklama: string } | null {
  const tur = pozisyonKaynagi(kayit)
  if (tur === 'ELLE') {
    return {
      tur,
      etiket: 'Şemada yok',
      aciklama: 'Pozisyon org şemasında bulunamadı, talep eden elle yazdı.',
    }
  }
  if (tur === 'SEMA') {
    return {
      tur,
      etiket: `Şemadan · ${kayit.pozisyonOrgKodu}`,
      aciklama: 'Pozisyon, bölümün organizasyon şemasındaki kutudan seçildi.',
    }
  }
  return null
}
