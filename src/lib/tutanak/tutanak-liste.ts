/**
 * IV-FR-03 Tutanak Formu — liste süzme / sıralama / KPI (saf).
 *
 * İV listesi, Excel export'u ve detay ekranı aynı kuralı kullansın diye ayrıldı;
 * deneme listesi sıralamasıyla (deneme-liste-siralama.ts) aynı üç durumlu desen.
 */

import type { TutanakDurum, TutanakSebep } from '@/generated/prisma'
import { DURUM_ETIKETLERI, SEBEP_ETIKETLERI } from './tutanak-durum'

export type TutanakSatiri = {
  id: string
  tutanakNo: string
  tutanakTarihi: string | Date
  adSoyadSnapshot: string
  sicilSnapshot: string | null
  bolumSnapshot: string
  gorevSnapshot: string | null
  sebep: TutanakSebep
  durum: TutanakDurum
  yoneticiAd: string | null
  sahitSayisi: number
  onaylayanSahitSayisi: number
  acanAd: string | null
  createdAt: string | Date
}

export type TutanakSuzgec = {
  arama?: string
  sebep?: TutanakSebep | 'HEPSI'
  durum?: TutanakDurum | 'HEPSI' | 'ACIK'
  bolum?: string | 'HEPSI'
}

const ACIK_DURUMLAR: TutanakDurum[] = ['TASLAK', 'SAHIT_BEKLIYOR', 'YONETICI_BEKLIYOR', 'IK_BEKLIYOR']

/** tr-TR küçük harf — "İŞ" → "iş" tuzağı (envanterAramaEslesir ile aynı kural). */
function kucuk(s: string): string {
  return s.toLocaleLowerCase('tr')
}

export function aramaEslesir(arama: string, alanlar: (string | null | undefined)[]): boolean {
  const q = kucuk(arama.trim())
  if (!q) return true
  return alanlar.some((a) => !!a && kucuk(a).includes(q))
}

export function tutanakSuz(satirlar: TutanakSatiri[], s: TutanakSuzgec): TutanakSatiri[] {
  return satirlar.filter((r) => {
    if (s.sebep && s.sebep !== 'HEPSI' && r.sebep !== s.sebep) return false
    if (s.bolum && s.bolum !== 'HEPSI' && r.bolumSnapshot !== s.bolum) return false
    if (s.durum && s.durum !== 'HEPSI') {
      if (s.durum === 'ACIK') {
        if (!ACIK_DURUMLAR.includes(r.durum)) return false
      } else if (r.durum !== s.durum) return false
    }
    if (
      s.arama &&
      !aramaEslesir(s.arama, [
        r.tutanakNo,
        r.adSoyadSnapshot,
        r.sicilSnapshot,
        r.bolumSnapshot,
        r.gorevSnapshot,
        r.yoneticiAd,
        r.acanAd,
        SEBEP_ETIKETLERI[r.sebep],
        DURUM_ETIKETLERI[r.durum],
      ])
    ) {
      return false
    }
    return true
  })
}

export const TUTANAK_SIRALAMA_ALANLARI = [
  'tutanakNo',
  'tutanakTarihi',
  'adSoyadSnapshot',
  'sicilSnapshot',
  'bolumSnapshot',
  'gorevSnapshot',
  'sebep',
  'durum',
  'yoneticiAd',
  'sahitSayisi',
  'acanAd',
] as const

export type TutanakSiralamaAlani = (typeof TUTANAK_SIRALAMA_ALANLARI)[number]
export type TutanakSiralama = { alan: TutanakSiralamaAlani; yon: 'asc' | 'desc' } | null

/** Üç durumlu başlık: yok → artan → azalan → yok. */
export function sonrakiSiralama(mevcut: TutanakSiralama, alan: TutanakSiralamaAlani): TutanakSiralama {
  if (!mevcut || mevcut.alan !== alan) return { alan, yon: 'asc' }
  if (mevcut.yon === 'asc') return { alan, yon: 'desc' }
  return null
}

function anahtar(r: TutanakSatiri, alan: TutanakSiralamaAlani): string | number {
  switch (alan) {
    case 'tutanakTarihi':
      return new Date(r.tutanakTarihi).getTime()
    case 'sahitSayisi':
      return r.sahitSayisi
    case 'sebep':
      return SEBEP_ETIKETLERI[r.sebep]
    case 'durum':
      return DURUM_ETIKETLERI[r.durum]
    default:
      return r[alan] ?? ''
  }
}

/**
 * Sıralama. `siralama` null ise DİZİ AYNEN döner (varsayılan sıra sunucudan gelir).
 * Boş/NaN anahtarlar yönden BAĞIMSIZ olarak sona atılır; eşitlikte özgün sıra korunur.
 */
export function tutanakSirala(satirlar: TutanakSatiri[], siralama: TutanakSiralama): TutanakSatiri[] {
  if (!siralama) return satirlar
  const { alan, yon } = siralama
  const carpan = yon === 'asc' ? 1 : -1
  const bos = (v: string | number) => (typeof v === 'number' ? Number.isNaN(v) : v === '')

  return satirlar
    .map((r, i) => ({ r, i, k: anahtar(r, alan) }))
    .sort((a, b) => {
      const ab = bos(a.k)
      const bb = bos(b.k)
      if (ab && bb) return a.i - b.i
      if (ab) return 1
      if (bb) return -1
      const c =
        typeof a.k === 'number' && typeof b.k === 'number'
          ? a.k - b.k
          : String(a.k).localeCompare(String(b.k), 'tr', { sensitivity: 'base', numeric: true })
      return c !== 0 ? c * carpan : a.i - b.i
    })
    .map((x) => x.r)
}

export type TutanakKpi = {
  toplam: number
  acik: number
  sahitBekleyen: number
  yoneticiBekleyen: number
  ivBekleyen: number
  tamamlanan: number
  reddedilen: number
}

export function tutanakKpi(satirlar: TutanakSatiri[]): TutanakKpi {
  const say = (d: TutanakDurum) => satirlar.filter((r) => r.durum === d).length
  return {
    toplam: satirlar.length,
    acik: satirlar.filter((r) => ACIK_DURUMLAR.includes(r.durum)).length,
    sahitBekleyen: say('SAHIT_BEKLIYOR'),
    yoneticiBekleyen: say('YONETICI_BEKLIYOR'),
    ivBekleyen: say('IK_BEKLIYOR'),
    tamamlanan: say('TAMAMLANDI'),
    reddedilen: say('REDDEDILDI'),
  }
}
