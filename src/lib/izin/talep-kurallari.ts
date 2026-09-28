/**
 * İzin Faz 3 — talep ve onay kuralları, SAF (DB yok, birim testli). Servis: talep-servis.ts.
 *
 * - Gün hesabı TEK fonksiyon: talepHesapla → izinGunleri (PDKS takvimi). Önizleme, talep kaydı ve İV onayı
 *   (günlerin dondurulduğu an) aynı fonksiyonu aynı girdiyle çağırır → önizleme = onay sonucu.
 * - Bakiye: bakiyeli türde (YILLIK) onizleme(); bekleyen talepler REZERVE. Onay anında KULLANIM yazılır.
 * - Onay akışı (plan §4.1):
 *     YALNIZ_IV türü / müdür muafiyeti / yöneticinin "adına" açtığı talep → doğrudan BEKLIYOR_IV
 *     yönetici çözülemedi (sahipsiz) → BEKLIYOR_IV + "sahipsiz" işareti (asla otomatik onay YOK)
 *     diğerleri → BEKLIYOR_YONETICI (3 adaydan biri yeter) → BEKLIYOR_IV → ONAYLANDI
 *   Atlanan yönetici kademesi IzinOnay satırı olarak kalır (karar ATLANDI + neden) — şema değişmeden iz.
 * - Kendi talebini onaylama YOK (yönetici ve İV kademesinde).
 */
import { onizleme } from './bakiye'
import { GUN, IzinGirdiHatasi, izinGunleri, type IzinGunu, type IzinYarim } from './gun-sayimi'

export interface TurKurali {
  kod: string
  ad: string
  bakiyeli: boolean
  sabitGun: number | null
  gunSayimi: 'IS_GUNU' | 'TAKVIM_GUNU' | 'PZT_CMT'
  yarimGunOlur: boolean
  onayAkisi: 'YONETICI_IV' | 'YALNIZ_IV'
  ozelNitelikli: boolean
  belgeZorunlu: boolean
  kosul: string | null
  aktif: boolean
  /** Faz 4: SAAT = saatlik (MAZERET); varsayılan GUN */
  birim?: 'GUN' | 'SAAT'
  yillikKotaDakika?: number | null
  yakaKisiti?: 'MAVI' | 'BEYAZ' | 'GRI' | null
}

/**
 * Talep formunda görünen türler. Faz 4: belge isteyen türler (evlilik, ölüm, evlat edinme, babalık, RAPOR)
 * artık AÇIK — belge yüklemeden gönderilemez. Yaka kısıtlı tür (MAZERET: yalnız beyaz yaka) başka yakaya gösterilmez.
 */
export const formdaGorunurMu = (t: Pick<TurKurali, 'aktif' | 'yakaKisiti'>, yaka?: string | null) =>
  t.aktif && (!t.yakaKisiti || !yaka || t.yakaKisiti === yaka)

export interface TalepGirdisi {
  baslangic: string
  bitis: string
  baslangicYarim: IzinYarim | null
  bitisYarim: IzinYarim | null
}

const ayAdlari = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
export const gunAdi = (t: string) => `${Number(t.slice(8, 10))} ${ayAdlari[Number(t.slice(5, 7)) - 1]}`

export interface TalepHesabi {
  gunler: IzinGunu[]
  toplam: number
  notlar: string[]
}

/**
 * Tür kurallarını uygular ve günleri sayar. `tatiller`: tarih → { tip, aciklama }.
 * Hata → IzinGirdiHatasi (kullanıcıya gösterilecek metin).
 */
export function talepHesapla(
  tur: TurKurali,
  g: TalepGirdisi,
  tatiller: ReadonlyMap<string, { tip: string; aciklama?: string | null }>,
  o: { sabitTatilSayilir?: boolean } = {},
): TalepHesabi {
  if (!GUN.test(g.baslangic) || !GUN.test(g.bitis)) throw new IzinGirdiHatasi('Başlangıç ve bitiş tarihi seçilmeli')
  if (!tur.aktif) throw new IzinGirdiHatasi(`${tur.ad} bu ekrandan talep edilemez`)
  if (tur.birim === 'SAAT') throw new IzinGirdiHatasi(`${tur.ad} saatlik izindir — saat aralığı seçin`)
  if ((g.baslangicYarim || g.bitisYarim) && !tur.yarimGunOlur) throw new IzinGirdiHatasi(`${tur.ad} için yarım gün seçilemez`)
  if (tur.kosul?.startsWith('DOGUM_TARIHI_GTE:')) {
    const esik = tur.kosul.split(':')[1]
    if (g.baslangic < esik) throw new IzinGirdiHatasi(`${tur.ad} ${gunAdi(esik)} ${esik.slice(0, 4)} ve sonrası doğumlar içindir; başlangıç bu tarihten önce olamaz`)
  }
  const tipler = new Map([...tatiller].map(([k, v]) => [k, v.tip]))
  const r = izinGunleri({ ...g, gunSayimi: tur.gunSayimi, tatiller: tipler, sabitTatilSayilir: o.sabitTatilSayilir })
  if (r.toplam <= 0) throw new IzinGirdiHatasi('Seçilen aralıkta düşülecek iş günü yok (hafta sonu / tatil)')
  if (tur.sabitGun !== null && r.toplam > tur.sabitGun) {
    throw new IzinGirdiHatasi(`${tur.ad} en fazla ${tur.sabitGun} ${tur.gunSayimi === 'TAKVIM_GUNU' ? 'takvim' : 'iş'} günü olabilir (seçilen ${fmt(r.toplam)})`)
  }

  const notlar: string[] = []
  if (tur.gunSayimi === 'PZT_CMT') {
    const pazar = r.gunler.filter((d) => new Date(`${d.tarih}T12:00:00Z`).getUTCDay() === 0).length
    if (pazar) notlar.push(`${pazar} Pazar günü sayılmadı`)
    for (const d of r.gunler) {
      const t = tatiller.get(d.tarih)
      if (d.takvim === 'TATIL' && d.pay === 0 && new Date(`${d.tarih}T12:00:00Z`).getUTCDay() !== 0) notlar.push(`${gunAdi(d.tarih)} ${t?.aciklama ?? 'tatil'} · sayılmadı`)
    }
  }
  if (tur.gunSayimi === 'IS_GUNU') {
    for (const d of r.gunler) {
      const t = tatiller.get(d.tarih)
      if (d.takvim === 'TATIL') notlar.push(`${gunAdi(d.tarih)} ${t?.aciklama ?? 'tatil'} · düşülmedi`)
      else if (d.takvim === 'YARIM') notlar.push(`${gunAdi(d.tarih)} ${t?.aciklama ?? 'arefe'} · ${d.pay === 0 ? 'düşülmedi' : 'yarım gün'}`)
    }
    const hs = r.gunler.filter((d) => d.takvim === 'HAFTA_SONU').length
    if (hs) notlar.push(`${hs} hafta sonu günü düşülmedi`)
  }
  return { gunler: r.gunler, toplam: r.toplam, notlar }
}

export const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })

/** Bakiyeli türde önizleme ("Kalan A → B"); bakiyesiz türde null. */
export function bakiyeEtkisi(tur: Pick<TurKurali, 'bakiyeli'>, o: { bakiye: number; bekleyen: number[]; talep: number }) {
  if (!tur.bakiyeli) return null
  return onizleme({ bakiye: o.bakiye, bekleyen: o.bekleyen, yeniTalep: o.talep })
}

// ── Akış ─────────────────────────────────────────────────────────────────────

export type Atlama = 'YALNIZ_IV' | 'MUDUR_MUAF' | 'YONETICI_ADINA' | 'SAHIPSIZ'

export function ilkDurum(o: {
  onayAkisi: 'YONETICI_IV' | 'YALNIZ_IV'
  muaf: boolean
  /** talebi açan kullanıcı, kişinin onaycılarından biri (yönetici "adına") */
  yoneticiAdina: boolean
  onaycilar: (string | null)[]
}): { durum: 'BEKLIYOR_YONETICI' | 'BEKLIYOR_IV'; atlama: Atlama | null } {
  if (o.onayAkisi === 'YALNIZ_IV') return { durum: 'BEKLIYOR_IV', atlama: 'YALNIZ_IV' }
  if (o.yoneticiAdina) return { durum: 'BEKLIYOR_IV', atlama: 'YONETICI_ADINA' }
  if (o.muaf) return { durum: 'BEKLIYOR_IV', atlama: 'MUDUR_MUAF' }
  if (!o.onaycilar.some(Boolean)) return { durum: 'BEKLIYOR_IV', atlama: 'SAHIPSIZ' }
  return { durum: 'BEKLIYOR_YONETICI', atlama: null }
}

export const ATLAMA_METNI: Record<Atlama, string> = {
  YALNIZ_IV: 'tür yalnız İV onaylı',
  MUDUR_MUAF: 'müdür muafiyeti',
  YONETICI_ADINA: 'yönetici adına açtı',
  SAHIPSIZ: 'yönetici çözülemedi (sahipsiz)',
}

export type Kademe = 'YONETICI' | 'IV'

/**
 * Onay yetkisi. null = yetkili; metin = neden yetkisiz.
 * Yönetici kademesinde yalnız talep anında çözülen 3 adaydan biri; İV kademesinde izin.admin.
 * Her iki kademede de kişi KENDİ talebini onaylayamaz.
 */
export function onayYetkisi(
  t: { durum: string; personnelId: string; onayci1Id: string | null; onayci2Id: string | null; onayci3Id: string | null },
  k: { userId: string; personnelId: string | null; ivMi: boolean },
): { kademe: Kademe } | { hata: string } {
  if (k.personnelId && k.personnelId === t.personnelId) return { hata: 'Kendi izin talebinizi onaylayamazsınız' }
  if (t.durum === 'BEKLIYOR_YONETICI') {
    return [t.onayci1Id, t.onayci2Id, t.onayci3Id].includes(k.userId) ? { kademe: 'YONETICI' } : { hata: 'Bu talebin onaycısı değilsiniz' }
  }
  if (t.durum === 'BEKLIYOR_IV') return k.ivMi ? { kademe: 'IV' } : { hata: 'İV onayı yetkisi (izin.admin) gerekli' }
  return { hata: 'Talep onay beklemiyor' }
}

/** Red gerekçesi zorunlu (API + ekran). */
export function kararDogrula(b: { karar?: unknown; gerekce?: unknown }): { karar: 'ONAY' | 'RED'; gerekce: string | null } {
  if (b.karar !== 'ONAY' && b.karar !== 'RED') throw new IzinGirdiHatasi('Karar ONAY ya da RED olmalı')
  const gerekce = typeof b.gerekce === 'string' ? b.gerekce.trim() : ''
  if (b.karar === 'RED' && gerekce.length < 5) throw new IzinGirdiHatasi('Red gerekçesi zorunlu (en az 5 karakter)')
  if (gerekce.length > 500) throw new IzinGirdiHatasi('Gerekçe en fazla 500 karakter')
  return { karar: b.karar, gerekce: gerekce || null }
}

/** Onaylı izin başlamadan iptal edilebilir (İV). Başlamış iznin kısaltılması ayrı iş (plan §8). */
export const iptalEdilebilirMi = (t: { durum: string; baslangic: string }, bugun: string) => t.durum === 'ONAYLANDI' && t.baslangic > bugun

/** Çalışanın geri çekmesi: yalnız bekleyen talep. */
export const geriCekilebilirMi = (t: { durum: string }) => t.durum === 'BEKLIYOR_YONETICI' || t.durum === 'BEKLIYOR_IV'


// ── Faz 4: saatlik izin (MAZERET) ───────────────────────────────────────────

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/
const dk = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
export const saatFmt = (dakika: number) => `${(dakika / 60).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} sa`

/** Saatlik talep: tek gün, [bas, bit) aralığı, çalışma gününde (hafta sonu / tam tatil değil). En çok 9 saat. */
export function saatlikHesapla(
  tur: Pick<TurKurali, 'ad' | 'birim' | 'aktif'>,
  g: { tarih: string; baslangicSaat: string; bitisSaat: string },
  tatiller: ReadonlyMap<string, { tip: string }>,
): { dakika: number } {
  if (tur.birim !== 'SAAT') throw new IzinGirdiHatasi(`${tur.ad} günlük izindir`)
  if (!tur.aktif) throw new IzinGirdiHatasi(`${tur.ad} bu ekrandan talep edilemez`)
  if (!GUN.test(g.tarih)) throw new IzinGirdiHatasi('Tarih seçilmeli')
  if (!SAAT.test(g.baslangicSaat) || !SAAT.test(g.bitisSaat)) throw new IzinGirdiHatasi('Başlangıç ve bitiş saati "SS:dd" olmalı')
  const dakika = dk(g.bitisSaat) - dk(g.baslangicSaat)
  if (dakika <= 0) throw new IzinGirdiHatasi('Bitiş saati başlangıçtan sonra olmalı')
  if (dakika > 9 * 60) throw new IzinGirdiHatasi('Saatlik izin en çok 9 saat olabilir — tam gün için günlük izin seçin')
  const hg = new Date(`${g.tarih}T12:00:00Z`).getUTCDay()
  if (hg === 0 || hg === 6 || tatiller.get(g.tarih)?.tip === 'TATIL') throw new IzinGirdiHatasi('Saatlik izin yalnız çalışma gününe alınır')
  return { dakika }
}

/** Dönem kotası (MAZERET 54 saat = 3240 dk): bekleyen + onaylı talepler rezerve. */
export function saatKotasi(o: { kotaDk: number; kullanilanDk: number; talepDk: number }) {
  const kalanDk = o.kotaDk - o.kullanilanDk
  return { kotaDk: o.kotaDk, kalanDk, sonrasiDk: kalanDk - o.talepDk, yeterli: kalanDk - o.talepDk >= 0 }
}

/** Mazeret dönemi (izin_mazeret_donem): TAKVIM_YILI (varsayılan) → [yıl-01-01, yıl-12-31]. */
export function mazeretDonemi(tarih: string, donem: string | null | undefined): { bas: string; bit: string } {
  const yil = tarih.slice(0, 4)
  // ISE_GIRIS_YILI vb. İV teyidinden sonra — şimdilik yalnız takvim yılı
  void donem
  return { bas: `${yil}-01-01`, bit: `${yil}-12-31` }
}

// ── Faz 4: belge doğrulama ───────────────────────────────────────────────────

export const MAKS_BELGE = 10 * 1024 * 1024
const IMZA: { mime: string; uzanti: string; ilk: number[] }[] = [
  { mime: 'application/pdf', uzanti: 'pdf', ilk: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', uzanti: 'png', ilk: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', uzanti: 'jpg', ilk: [0xff, 0xd8, 0xff] },
]

/** İçerik imzasıyla (uzantı/istemci mime'ına GÜVENİLMEZ) PDF / PNG / JPEG; ≤ 10 MB. */
export function belgeDogrula(icerik: Uint8Array): { mime: string; uzanti: string } {
  if (icerik.length === 0) throw new IzinGirdiHatasi('Belge boş')
  if (icerik.length > MAKS_BELGE) throw new IzinGirdiHatasi('Belge en çok 10 MB olabilir')
  const t = IMZA.find((x) => x.ilk.every((b, i) => icerik[i] === b))
  if (!t) throw new IzinGirdiHatasi('Belge PDF, JPG ya da PNG olmalı')
  return { mime: t.mime, uzanti: t.uzanti }
}
