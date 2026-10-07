// ============================================================================
// PİLOT ATAMA DÖNÜŞTÜRÜCÜ — canlı Personel export'u (Sicil / Servis / Durak) →
// Excel toplu atama şablonu satırları. SAF: DB'ye, dosyaya, ağa dokunmaz.
//
// Giriş/çıkış dosyaları scripts/servis-pilot-atama-donustur.ts'te. Kişisel veri
// dosyaları repoya girmez (~/pilot-veri/).
//
// 🔴 KURAL: emin değilsek TAHMİN ETMEYİZ — satır "eşleşmeyen" listesine gider,
// nedeniyle birlikte. Durak yalnız (a) İdari İşler eşleme tablosundaki ham metin
// (DURAK_ESLEME) ya da (b) güzergâh içinde Türkçe-normalize BİREBİR ad eşleşmesi
// ile bulunur; bulanık eşleşme yok.
//
// Servis adı sözlüğü: göç script'indeki (feat/servis-goc-script, goc-siniflandirma.ts)
// Melih onaylı sözlüğün KOPYASI — o dal main'e girince tek kaynağa indirilmeli.
// Durak kodu: servis-durak-kodu.ts (tek kaynak) + servis-tanim-verisi.ts sırası.
// ============================================================================

import { DURAK_ESLEME, TUM_GUZERGAHLAR } from './servis-tanim-verisi'
import { durakKodu } from './servis-durak-kodu'

const TR_MAP: Record<string, string> = {
  ç: 'C', ğ: 'G', ş: 'S', ö: 'O', ü: 'U', ı: 'I', İ: 'I', Ç: 'C', Ğ: 'G', Ş: 'S', Ö: 'O', Ü: 'U',
}

/** upper(translate(...)) + [^A-Z0-9] — göç script'iyle AYNI; düz upper() YOK. */
export function normalizeTR(input: string | null | undefined): string {
  if (!input) return ''
  return input.split('').map((ch) => TR_MAP[ch] ?? ch).join('').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Ham servis adı → güzergâh kodu (Melih onaylı sözlük + takma adlar). */
export const SERVIS_ADI_TO_GUZERGAH: Record<string, string> = {
  'ARAPÇEŞME': 'ARAPCESME',
  'AYDOS-KURTKÖY': 'AYDOS_KURTKOY',
  'BEYLİKBAĞI GÜZELTEPE': 'BEYLIKBAGI_GUZELTEPE',
  // Elif 2026-09-24: ÇAYIROVA ÇAĞDAŞKENT, BEYLİKBAĞI GÜZELTEPE ile aynı güzergâh.
  'BEYLİKBAĞI GÜZELTEPE/ÇAYIROVA': 'BEYLIKBAGI_GUZELTEPE',
  'BEYLİKBAĞI ULAŞTEPE': 'BEYLIKBAGI_ULASTEPE',
  'ÇARŞI-DEVELİ': 'GEBZE_DEVELI',
  'DARICA': 'DARICA',
  'GEBZE DEVELİ': 'GEBZE_DEVELI',
  'KAVACIK-BEYKOZ': 'KAVACIK_BEYKOZ',
  'KAYNARCA-KARTAL': 'KAYNARCA_KARTAL',
  'KAYNARCA PENDİK': 'KAYNARCA_KARTAL',
  'TOSB SERVİS': 'TOSB',
  'ÜSKÜDAR': 'USKUDAR',
}
const GUZERGAH_BY_NORM = new Map(Object.entries(SERVIS_ADI_TO_GUZERGAH).map(([k, v]) => [normalizeTR(k), v]))

/** İK kararı bekleyen terimler — eşleştirilmez. */
const KARARA_BAGLI = new Set(['ARAPEŞME', 'GEBZE', 'BELEDİYE', 'BEYKOZ KAVACIK'].map(normalizeTR))
const KENDI_GELIYOR = new Set(['KENDİ GELİYOR', 'KENDİ ARACI'].map(normalizeTR))
const SIRKET_ARACI = new Set(['İZMİT', 'ŞİRKET ARACI'].map(normalizeTR))
const SERVIS_YOK = new Set(['SERVİS YOK', 'SERVİSİ YOK'].map(normalizeTR))

/** Excel toplu atama şablonunun başlıkları (excel-atama.ts SABLON_BASLIKLARI ile aynı; test sabitler). */
export const PILOT_SABLON_BASLIKLARI = ['Sicil No', 'Güzergâh Kodu', 'Durak Kodu', 'Sefer Dilimi Kodu(ları)', 'Başlangıç Tarihi'] as const

export type PilotGirdiSatiri = { satirNo: number; sicil: string; servis: string; durak: string }
export type AtamaSatiri = { satirNo: number; sicil: string; guzergahKod: string; durakKod: string }
export type EslesmeyenSatir = { satirNo: number; sicil: string; servis: string; durak: string; neden: string }
export type AtamaUretilmeyen = { satirNo: number; sicil: string; servis: string; durak: string; sebep: 'KENDI_GELIYOR' | 'IZMIT_SIRKET_ARACI' | 'SERVIS_YOK' | 'BOS' }

export type DonusumSonucu = {
  atamalar: AtamaSatiri[]
  eslesmeyenler: EslesmeyenSatir[]
  atamaUretilmeyenler: AtamaUretilmeyen[]
}

const guzergahlar = new Map(TUM_GUZERGAHLAR.map((g) => [g.kod, g]))

type DurakSonucu = { ok: true; kod: string } | { ok: false; neden: string }

/** Durak adını ham metinden güzergâh içinde durak koduna çevirir; emin değilse neden döner. */
export function durakCoz(guzergahKod: string, hamDurak: string): DurakSonucu {
  const g = guzergahlar.get(guzergahKod)
  if (!g) return { ok: false, neden: `Güzergâh tanımda yok: ${guzergahKod}` }
  const norm = normalizeTR(hamDurak)
  if (!norm) return { ok: false, neden: 'Durak boş' }

  // (a) İdari İşler eşleme tablosu: aynı güzergâhta, ham metin birebir (normalize)
  const eslemeler = DURAK_ESLEME.filter((e) => e.guzergah === guzergahKod && normalizeTR(e.hamMetin) === norm)
  const hedefler = [...new Set(eslemeler.map((e) => normalizeTR(e.hedef)))]
  if (hedefler.length > 1) return { ok: false, neden: 'Eşleme tablosunda aynı ham metin birden çok hedefe bağlı' }
  const hedefNorm = hedefler[0] ?? norm

  // (b) güzergâh içinde birebir ad
  const adaylar = g.duraklar.filter((d) => normalizeTR(d.ad) === hedefNorm)
  if (adaylar.length === 0) return { ok: false, neden: `Durak bu güzergâhta bulunamadı (${guzergahKod}): "${hamDurak.trim()}"` }
  if (adaylar.length > 1) {
    return { ok: false, neden: `Aynı adlı birden çok durak var (${adaylar.map((d) => durakKodu(guzergahKod, d.sira)).join(', ')}); hangisi belirsiz` }
  }
  return { ok: true, kod: durakKodu(guzergahKod, adaylar[0].sira) }
}

export function donustur(girdi: PilotGirdiSatiri[]): DonusumSonucu {
  const atamalar: AtamaSatiri[] = []
  const eslesmeyenler: EslesmeyenSatir[] = []
  const atamaUretilmeyenler: AtamaUretilmeyen[] = []

  // Aynı sicil birden çok satırda → hepsi eşleşmeyen (hangisi geçerli belirsiz; Excel de reddeder)
  const sicilSayisi = new Map<string, number>()
  for (const s of girdi) {
    const k = s.sicil.trim()
    if (k) sicilSayisi.set(k, (sicilSayisi.get(k) ?? 0) + 1)
  }

  for (const s of girdi) {
    const sicil = s.sicil.trim()
    const servis = s.servis.trim()
    const durak = s.durak.trim()
    const eslesmedi = (neden: string) => eslesmeyenler.push({ satirNo: s.satirNo, sicil, servis, durak, neden })
    const uretilmedi = (sebep: AtamaUretilmeyen['sebep']) => atamaUretilmeyenler.push({ satirNo: s.satirNo, sicil, servis, durak, sebep })

    const normServis = normalizeTR(servis)
    if (!normServis && !durak) { if (sicil) uretilmedi('BOS'); continue }
    if (!sicil) { eslesmedi('Sicil boş'); continue }
    if ((sicilSayisi.get(sicil) ?? 0) > 1) { eslesmedi('Aynı sicil dosyada birden çok satırda'); continue }

    if (KENDI_GELIYOR.has(normServis)) { uretilmedi('KENDI_GELIYOR'); continue }
    if (SIRKET_ARACI.has(normServis)) { uretilmedi('IZMIT_SIRKET_ARACI'); continue }
    if (SERVIS_YOK.has(normServis)) { uretilmedi('SERVIS_YOK'); continue }
    if (!normServis) { eslesmedi('Servis boş, durak dolu'); continue }
    if (KARARA_BAGLI.has(normServis)) { eslesmedi('Servis adı İK kararı bekliyor'); continue }

    const guzergahKod = GUZERGAH_BY_NORM.get(normServis)
    if (!guzergahKod) { eslesmedi('Servis adı sözlükte yok'); continue }
    if (!guzergahlar.has(guzergahKod)) { eslesmedi(`Güzergâh tanımda yok: ${guzergahKod}`); continue }

    const d = durakCoz(guzergahKod, durak)
    if (!d.ok) { eslesmedi(d.neden); continue }
    atamalar.push({ satirNo: s.satirNo, sicil, guzergahKod, durakKod: d.kod })
  }
  return { atamalar, eslesmeyenler, atamaUretilmeyenler }
}
