/**
 * PDKS Faz 2 — BizManager kart listesi import'u (plan §6.1).
 *
 * KİLİTLİ KARARLAR
 * - Aktif/pasif TEK KAYNAK Hub Personnel. BizManager listesinden YALNIZ sicil → kart no alınır
 *   (ad/soyad/departman OKUNMAZ — KVKK veri minimizasyonu; rapor Hub'daki adı kullanır).
 * - Eşleşme: sicil (normalize) → Personnel.sicilNo. Hub'da pasif / yok → import EDİLMEZ,
 *   raporda "güvenlik bulgusu". Dosyada mükerrer sicil → çakışma (atlanır). Aynı kart iki
 *   sicilde → çakışma (atlanır).
 * - Varsayılan DRY-RUN; --apply olmadan DB'ye tek satır yazılmaz. Eşleşmeyen oranı eşiği
 *   (%10) aşarsa apply DURUR.
 *
 * ESLESMEYEN ORANI — payda bilinçli seçildi: BizManager'da AKTİF (Çıkış boş) ve KARTLI satırlar;
 * pay: bunlardan sicili Hub'da HİÇ bulunamayanlar. Tüm kartlı satırlar payda olsaydı yıllardır
 * ayrılmış 500+ kişi ve Hub'da hiç olmayan stajyer (STJ) sicilleri oranı her zaman eşiğin üstüne
 * iterdi ve kapı anlamsızlaşırdı. Bu oran "sicil normalizasyonu / yanlış dosya" hatasını yakalar.
 *
 * Bu modül Next.js DIŞINDA (tsx script) da çalışır: 'server-only' ve '@/lib/prisma' İMPORT ETMEZ;
 * DB istemcisi parametre olarak gelir.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import type { PrismaClient } from '../../generated/prisma'
import { KartNoHatasi, kartHamCoz, kartNoDonustur, kartNoGoster, type KartNoBicimi } from './kart-no'

export const IMPORT_KAYNAK = 'BIZMANAGER_IMPORT'
export const ESLESMEYEN_ESIK_VARSAYILAN = 0.1

// ── Excel okuma ──────────────────────────────────────────────────────────────

export interface BizSatir {
  /** Excel satır numarası (1 tabanlı) */
  satir: number
  sicilHam: string
  sicil: string
  /** Kart No hücresi (metin; boşsa null) */
  kartGirdi: string | null
  /** BizManager'a göre ayrılmış mı (Çıkış Tarihi dolu) */
  ayrildi: boolean
}

export interface BizOkumaSonucu {
  satirlar: BizSatir[]
  baslikSatiri: number
  atlananToplamSatiri: number | null
}

/** "ilr 00207", "ILR00207", " ILR-00207 " → "ILR-00207". Tanımadığı biçimi büyük harfle bırakır. */
export function sicilNormalize(s: unknown): string {
  const t = String(s ?? '').trim().toUpperCase().replace(/\s+/g, '')
  const m = /^([A-Z]+)-?(\d+)$/.exec(t)
  return m ? `${m[1]}-${m[2]}` : t
}

/**
 * BizManager PDLIST01 export'u. Başlık satırı "Sicil No" hücresinden bulunur (bugün 5. satır);
 * Firma sütunu "Toplam" ile başlayan satır VERİ DEĞİLDİR, atlanır. Kart No METİN okunur
 * (baştaki sıfırlar korunur; hücre sayıysa ve 8 haneden kısaysa sıfırla doldurulmaz —
 * kartHamCoz reddeder ve rapora düşer).
 */
export function bizManagerOku(dosya: string): BizOkumaSonucu {
  const wb = XLSX.readFile(dosya, { cellText: true, raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws || !ws['!ref']) throw new Error(`${path.basename(dosya)}: ilk sayfa boş`)
  const A = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: null })

  const baslikIdx = A.slice(0, 30).findIndex((r) => r.some((v) => typeof v === 'string' && v.trim() === 'Sicil No'))
  if (baslikIdx < 0) throw new Error('"Sicil No" başlığı ilk 30 satırda bulunamadı — BizManager PDLIST01 biçimi değil')
  const baslik = A[baslikIdx].map((v) => (typeof v === 'string' ? v.trim() : ''))
  const col = (ad: string) => {
    const i = baslik.indexOf(ad)
    if (i < 0) throw new Error(`"${ad}" sütunu yok (başlık satırı ${baslikIdx + 1})`)
    return i
  }
  const cFirma = col('Firma')
  const cSicil = col('Sicil No')
  const cKart = col('Kart No')
  const cCikis = col('Çıkış Tarihi')

  const metin = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
  const satirlar: BizSatir[] = []
  let atlananToplamSatiri: number | null = null
  for (let i = baslikIdx + 1; i < A.length; i++) {
    const r = A[i] ?? []
    if (/^toplam/i.test(metin(r[cFirma]))) {
      atlananToplamSatiri = i + 1
      continue
    }
    const sicilHam = metin(r[cSicil])
    if (!sicilHam) continue
    const kart = metin(r[cKart])
    satirlar.push({
      satir: i + 1,
      sicilHam,
      sicil: sicilNormalize(sicilHam),
      kartGirdi: kart || null,
      ayrildi: metin(r[cCikis]) !== '',
    })
  }
  return { satirlar, baslikSatiri: baslikIdx + 1, atlananToplamSatiri }
}

// ── Sınıflandırma (SAF — DB yok, birim testli) ──────────────────────────────

export type ImportSinif =
  | 'ESLESEN' // import edilecek
  | 'ZATEN_VAR' // Hub'da aynı kart zaten AKTİF — atlanır
  | 'HUBDA_PASIF_KARTLI' // güvenlik bulgusu
  | 'HUBDA_YOK' // güvenlik bulgusu
  | 'CAKISMA_MUKERRER_SICIL'
  | 'CAKISMA_MUKERRER_KART'
  | 'CAKISMA_GECERSIZ_KART'
  | 'CAKISMA_HUB_FARKLI_KART' // kişinin Hub'da başka AKTİF kartı var
  | 'CAKISMA_KART_BASKASINDA' // kart Hub'da başka kişide AKTİF
  | 'KARTSIZ' // dosyada kart boş — bilgi

export const GUVENLIK_BULGUSU: ReadonlySet<ImportSinif> = new Set(['HUBDA_PASIF_KARTLI', 'HUBDA_YOK'])

export interface HubPersonel {
  id: string
  sicilNo: string | null
  adSoyad: string
  aktif: boolean
  departman: string | null
}

export interface HubAktifKart {
  personnelId: string
  kartNoHam: string | null
}

export interface ImportKaydi {
  satir: number
  sicil: string
  ayrildi: boolean
  kartHam: string | null
  sinif: ImportSinif
  guvenlikBulgusu: boolean
  personel: HubPersonel | null
  aciklama: string
}

export interface SiniflandirmaSonucu {
  kayitlar: ImportKaydi[]
  hubAktifKartsiz: HubPersonel[]
  ozet: Record<ImportSinif, number>
  eslesmeyen: { pay: number; payda: number; oran: number }
}

const TUM_SINIFLAR: ImportSinif[] = [
  'ESLESEN', 'ZATEN_VAR', 'HUBDA_PASIF_KARTLI', 'HUBDA_YOK', 'CAKISMA_MUKERRER_SICIL',
  'CAKISMA_MUKERRER_KART', 'CAKISMA_GECERSIZ_KART', 'CAKISMA_HUB_FARKLI_KART', 'CAKISMA_KART_BASKASINDA', 'KARTSIZ',
]

export function siniflandir(
  satirlar: BizSatir[],
  personeller: HubPersonel[],
  hubAktifKartlar: HubAktifKart[],
): SiniflandirmaSonucu {
  const sicilSayisi = new Map<string, number>()
  for (const s of satirlar) sicilSayisi.set(s.sicil, (sicilSayisi.get(s.sicil) ?? 0) + 1)

  // Dosyada aynı ham kartın kaç FARKLI sicilde geçtiği (geçerli kartlar üzerinden)
  const kartSicilleri = new Map<string, Set<string>>()
  const hamlar = new Map<number, string | KartNoHatasi>()
  for (const s of satirlar) {
    if (!s.kartGirdi) continue
    try {
      const ham = kartHamCoz(s.kartGirdi).ham
      hamlar.set(s.satir, ham)
      if (!kartSicilleri.has(ham)) kartSicilleri.set(ham, new Set())
      kartSicilleri.get(ham)!.add(s.sicil)
    } catch (e) {
      hamlar.set(s.satir, e instanceof KartNoHatasi ? e : new KartNoHatasi(String(e)))
    }
  }

  const personelBySicil = new Map<string, HubPersonel>()
  for (const p of personeller) if (p.sicilNo) personelBySicil.set(sicilNormalize(p.sicilNo), p)
  const hubKartByPersonel = new Map<string, string | null>()
  const hubPersonelByKart = new Map<string, string>()
  for (const k of hubAktifKartlar) {
    hubKartByPersonel.set(k.personnelId, k.kartNoHam)
    if (k.kartNoHam) hubPersonelByKart.set(k.kartNoHam, k.personnelId)
  }

  const kayitlar: ImportKaydi[] = []
  for (const s of satirlar) {
    const personel = personelBySicil.get(s.sicil) ?? null
    const kaydet = (sinif: ImportSinif, aciklama: string, kartHam: string | null) =>
      kayitlar.push({
        satir: s.satir, sicil: s.sicil, ayrildi: s.ayrildi, kartHam, sinif,
        guvenlikBulgusu: GUVENLIK_BULGUSU.has(sinif), personel, aciklama,
      })

    if (!s.kartGirdi) {
      kaydet('KARTSIZ', 'dosyada kart no boş', null)
      continue
    }
    const h = hamlar.get(s.satir)!
    if (h instanceof KartNoHatasi) {
      kaydet('CAKISMA_GECERSIZ_KART', h.message, null)
      continue
    }
    if ((sicilSayisi.get(s.sicil) ?? 0) > 1) {
      kaydet('CAKISMA_MUKERRER_SICIL', `sicil dosyada ${sicilSayisi.get(s.sicil)} satırda`, h)
      continue
    }
    const sicilleri = kartSicilleri.get(h)!
    if (sicilleri.size > 1) {
      kaydet('CAKISMA_MUKERRER_KART', `kart dosyada ${sicilleri.size} sicilde: ${[...sicilleri].join(', ')}`, h)
      continue
    }
    if (!personel) {
      kaydet('HUBDA_YOK', `sicil Hub'da yok${s.ayrildi ? '' : ' — BizManager AKTİF gösteriyor'}`, h)
      continue
    }
    if (!personel.aktif) {
      kaydet('HUBDA_PASIF_KARTLI', `Hub'da pasif${s.ayrildi ? '' : ' — BizManager AKTİF gösteriyor'}`, h)
      continue
    }
    const mevcut = hubKartByPersonel.get(personel.id)
    if (mevcut !== undefined) {
      if (mevcut === h) kaydet('ZATEN_VAR', 'Hub\'da aynı kart zaten aktif', h)
      else kaydet('CAKISMA_HUB_FARKLI_KART', `Hub'da başka aktif kartı var (${kartNoGoster(mevcut)})`, h)
      continue
    }
    const baskasi = hubPersonelByKart.get(h)
    if (baskasi && baskasi !== personel.id) {
      kaydet('CAKISMA_KART_BASKASINDA', 'kart Hub\'da başka bir kişide aktif', h)
      continue
    }
    kaydet('ESLESEN', s.ayrildi ? 'BizManager ayrıldı gösteriyor ama Hub aktif — Hub esas' : '', h)
  }

  const karta = new Set(kayitlar.filter((k) => k.sinif === 'ESLESEN' || k.sinif === 'ZATEN_VAR').map((k) => k.personel!.id))
  const hubAktifKartsiz = personeller
    .filter((p) => p.aktif && !karta.has(p.id) && !hubKartByPersonel.has(p.id))
    .sort((a, b) => (a.sicilNo ?? '').localeCompare(b.sicilNo ?? ''))

  const ozet = Object.fromEntries(TUM_SINIFLAR.map((c) => [c, 0])) as Record<ImportSinif, number>
  for (const k of kayitlar) ozet[k.sinif]++

  // Payda: BizManager'da AKTİF ve kart hücresi DOLU satırlar (geçersiz kart dahil).
  const payda = kayitlar.filter((k) => k.sinif !== 'KARTSIZ' && !k.ayrildi)
  const pay = payda.filter((k) => k.sinif === 'HUBDA_YOK').length
  return {
    kayitlar,
    hubAktifKartsiz,
    ozet,
    eslesmeyen: { pay, payda: payda.length, oran: payda.length ? pay / payda.length : 0 },
  }
}

// ── Rapor ────────────────────────────────────────────────────────────────────

const csvAlan = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Raporu <dizin> altına yazar (dizin 700, dosyalar 600 — KİŞİ VERİSİ; public/uploads ASLA).
 * Döner: yazılan dosya yolları.
 */
export function raporYaz(
  dizin: string,
  sonuc: SiniflandirmaSonucu,
  meta: Record<string, unknown>,
  etiket: string,
): { csv: string; json: string } {
  fs.mkdirSync(dizin, { recursive: true, mode: 0o700 })
  const csv = path.join(dizin, `kart-import-${etiket}.csv`)
  const json = path.join(dizin, `kart-import-${etiket}.json`)
  const satirlar = [
    'bolum;excel_satir;sicil;biz_durum;kart_no;sinif;guvenlik_bulgusu;hub_durum;hub_ad_soyad;hub_departman;aciklama',
    ...sonuc.kayitlar
      .filter((k) => k.sinif !== 'KARTSIZ')
      .map((k) =>
        [
          'BIZMANAGER', k.satir, k.sicil, k.ayrildi ? 'AYRILDI' : 'AKTIF', kartNoGoster(k.kartHam), k.sinif,
          k.guvenlikBulgusu ? 'EVET' : '', k.personel ? (k.personel.aktif ? 'AKTIF' : 'PASIF') : 'YOK',
          k.personel?.adSoyad ?? '', k.personel?.departman ?? '', k.aciklama,
        ].map(csvAlan).join(';'),
      ),
    ...sonuc.hubAktifKartsiz.map((p) =>
      ['HUB_AKTIF_KARTSIZ', '', p.sicilNo ?? '', '', '', 'HUB_AKTIF_KARTSIZ', '', 'AKTIF', p.adSoyad, p.departman ?? '', 'Hub aktif, kartı yok']
        .map(csvAlan).join(';'),
    ),
  ]
  fs.writeFileSync(csv, '﻿' + satirlar.join('\n') + '\n', { mode: 0o600 })
  fs.writeFileSync(
    json,
    JSON.stringify({ ...meta, ozet: sonuc.ozet, eslesmeyen: sonuc.eslesmeyen, hubAktifKartsiz: sonuc.hubAktifKartsiz.length }, null, 2),
    { mode: 0o600 },
  )
  fs.chmodSync(csv, 0o600)
  fs.chmodSync(json, 0o600)
  return { csv, json }
}

// ── DB ───────────────────────────────────────────────────────────────────────

type Db = Pick<PrismaClient, 'personnel' | 'pdksKart' | 'pdksCihaz' | '$transaction'>

export async function hubVerisiOku(db: Db): Promise<{ personeller: HubPersonel[]; aktifKartlar: HubAktifKart[] }> {
  const [ps, ks] = await Promise.all([
    db.personnel.findMany({
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true, department: { select: { name: true } } },
    }),
    db.pdksKart.findMany({ where: { durum: 'AKTIF' }, select: { personnelId: true, kartNoHam: true } }),
  ])
  return {
    personeller: ps.map((p) => ({
      id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, aktif: p.aktif, departman: p.department?.name ?? p.bolum ?? null,
    })),
    aktifKartlar: ks,
  }
}

/**
 * ESLESEN kayıtları yazar — TEK transaction. Her kart için aktif HIKVISION cihazlarına
 * BEKLIYOR senkron satırı açılır (cihaz yoksa senkron işçisi sonradan açar). Sonunda tek bir
 * özet denetim satırı. Kısmi unique (kişi başı tek AKTİF / kart tek kişide) yarışta P2002 ile
 * tüm işlemi geri alır — kısmi yazım olmaz.
 */
export async function uygula(
  db: Db,
  kayitlar: ImportKaydi[],
  bicim: KartNoBicimi,
  aktorId: string,
  raporDosyasi: string,
): Promise<{ yazilan: number }> {
  const hedef = kayitlar.filter((k) => k.sinif === 'ESLESEN')
  return db.$transaction(
    async (tx) => {
      const cihazlar = await tx.pdksCihaz.findMany({ where: { aktif: true, marka: 'HIKVISION' }, select: { id: true } })
      const simdi = new Date()
      for (const k of hedef) {
        const kart = await tx.pdksKart.create({
          data: {
            kartNoHam: k.kartHam!,
            kartNo: kartNoDonustur(k.kartHam!, bicim),
            personnelId: k.personel!.id,
            durum: 'AKTIF',
            gecerliBaslangic: simdi,
            kaynak: IMPORT_KAYNAK,
            createdById: aktorId,
          },
          select: { id: true },
        })
        if (cihazlar.length) {
          await tx.pdksKartCihaz.createMany({ data: cihazlar.map((c) => ({ kartId: kart.id, cihazId: c.id, durum: 'BEKLIYOR' })) })
        }
      }
      await tx.permissionAuditLog.create({
        data: {
          action: 'PDKS_KART_IMPORT',
          actorId: aktorId,
          targetType: 'PDKS_KART',
          targetId: '',
          details: { kaynak: IMPORT_KAYNAK, yazilan: hedef.length, bicim, rapor: path.basename(raporDosyasi) },
        },
      })
      return { yazilan: hedef.length }
    },
    { timeout: 60_000 },
  )
}
