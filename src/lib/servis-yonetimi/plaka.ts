// A6 — Araç plakası: normalizasyon, Türk plaka biçimi, benzer plaka tespiti.
//
// Normalizasyon: tr-TR büyük harf, boşluk ve tire temizliği ("41 p-0145" → "41P0145").
// Biçim: il kodu (01-81) + 1-3 harf (A-Z) + 2-4 rakam. Türkçe karakterler (Ç Ğ İ Ö Ş Ü)
// plakada kullanılmaz; sessizce ASCII'ye çevrilmez — açık Türkçe hata verilir (yazım
// hatasını gizlememek için).
//
// Benzer plaka: gözle karıştırılan çiftler O↔0, I↔1, S↔5, B↔8. İki plaka şu
// durumlarda "benzer"dir:
//   (a) bu eşlemeyle indirgenmiş anahtarları AYNI (41PO145 ↔ 41P0145), ya da
//   (b) anahtarları arasında tam olarak BİR karakter fazlalık/eksiklik var ve o
//       karakter bu karışık sınıftan (0/1/5/8) — ör. fazladan yazılmış O/0:
//       41PO0145 ↔ 41P0145.
// Rastgele tek karakter farkı (34LAC828 ↔ 34LAC829) BENZER SAYILMAZ: gerçekten
// farklı araçlar için sürekli uyarı çıkmasın.

export const PLAKA_BICIM_ACIKLAMASI =
  'Plaka il kodu (01-81), 1-3 harf ve 2-4 rakamdan oluşmalıdır (örn. 41P0145).'

const PLAKA_REGEX = /^(0[1-9]|[1-7][0-9]|8[01])[A-Z]{1,3}[0-9]{2,4}$/
const TURKCE_HARF = /[ÇĞİÖŞÜ]/

export function normalizePlaka(ham: string): string {
  return ham.replace(/[\s-]+/g, '').toLocaleUpperCase('tr-TR')
}

/** Biçim hatası mesajı (geçerliyse null). `normal` normalizePlaka() çıktısı olmalı. */
export function plakaBicimHatasi(normal: string): string | null {
  if (PLAKA_REGEX.test(normal)) return null
  const ipucu = TURKCE_HARF.test(normal) ? ' Plakada Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü) kullanılamaz.' : ''
  return `Geçersiz plaka biçimi: "${normal}". ${PLAKA_BICIM_ACIKLAMASI}${ipucu}`
}

const KARISIK: Record<string, string> = { O: '0', I: '1', S: '5', B: '8' }

/** O→0, I→1, S→5, B→8 indirgemesi (karışan karakterler tek sınıfa iner). */
export function benzerlikAnahtari(normal: string): string {
  return normal.replace(/[OISB]/g, (c) => KARISIK[c])
}

/** `uzun`, `kisa`dan tam olarak bir karakter eklenerek elde ediliyor mu ve eklenen 0/1/5/8 mi? */
function birKarisikKarakterFazla(uzun: string, kisa: string): boolean {
  if (uzun.length !== kisa.length + 1) return false
  for (let i = 0; i < uzun.length; i++) {
    if (uzun.slice(0, i) + uzun.slice(i + 1) === kisa) return '0158'.includes(uzun[i])
  }
  return false
}

/** İki NORMALİZE plaka benzer mi? (Aynı plaka "benzer" değil, "aynı"dır: çağıran önce kontrol eder.) */
export function plakalarBenzerMi(a: string, b: string): boolean {
  if (a === b) return false
  const ka = benzerlikAnahtari(a)
  const kb = benzerlikAnahtari(b)
  return ka === kb || birKarisikKarakterFazla(ka, kb) || birKarisikKarakterFazla(kb, ka)
}

export type MevcutPlaka = { id: string; plaka: string; aktif: boolean }

export type PlakaKontrolSonucu =
  | { tur: 'AYNI'; mevcut: MevcutPlaka }
  | { tur: 'BENZER'; benzerler: MevcutPlaka[] }
  | { tur: 'TEMIZ' }

/**
 * Yeni (normalize) plakayı mevcut kayıtlara karşı denetler. Mevcut kayıtların plakası da
 * normalize edilerek karşılaştırılır (eski, normalize edilmemiş kayıtlar da yakalansın).
 * `haricId`: düzenlenen aracın kendisi.
 */
export function plakaKontrol(yeni: string, mevcutlar: MevcutPlaka[], haricId?: string): PlakaKontrolSonucu {
  const adaylar = mevcutlar.filter((m) => m.id !== haricId)
  const ayni = adaylar.find((m) => normalizePlaka(m.plaka) === yeni)
  if (ayni) return { tur: 'AYNI', mevcut: ayni }
  const benzerler = adaylar.filter((m) => plakalarBenzerMi(yeni, normalizePlaka(m.plaka)))
  return benzerler.length > 0 ? { tur: 'BENZER', benzerler } : { tur: 'TEMIZ' }
}

export class BenzerPlakaHatasi extends Error {
  readonly benzerler: { plaka: string; aktif: boolean }[]
  constructor(benzerler: MevcutPlaka[]) {
    const liste = benzerler.map((b) => b.plaka).join(', ')
    super(`Benzer plaka var: ${liste} — aynı araç mı?`)
    this.name = 'BenzerPlakaHatasi'
    this.benzerler = benzerler.map((b) => ({ plaka: b.plaka, aktif: b.aktif }))
  }
}

export function ayniPlakaMesaji(mevcut: MevcutPlaka): string {
  return mevcut.aktif
    ? `"${mevcut.plaka}" plakası zaten kullanılıyor.`
    : `"${mevcut.plaka}" plakası pasif bir araç olarak kayıtlı. Yeni kayıt açmak yerine Geri Al ile etkinleştirin.`
}

/** Onaylı benzer-plaka kaydının audit açıklaması. */
export function benzerPlakaOnayAciklamasi(benzerler: MevcutPlaka[]): string {
  return `Benzer plaka uyarısı kullanıcı onayıyla geçildi: ${benzerler.map((b) => b.plaka).join(', ')}.`
}
