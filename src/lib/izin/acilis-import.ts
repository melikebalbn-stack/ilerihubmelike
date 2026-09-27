/**
 * İzin Faz 2 — açılış bakiyesi import'u (plan §5 "Açılış Bakiyesi Import", §3.2 "Açılış").
 * CLI (scripts/izin/acilis-ice-aktar.ts) ve ekran (/izin/yonetim/ice-aktarim) AYNI mantığı kullanır.
 *
 * KURALLAR
 * - Dosyadan YALNIZ sicil + kalan gün okunur (ad/departman OKUNMAZ — rapor Hub'daki adı kullanır).
 * - Kalan: ≥ 0, 0,5'in katı, ≤ MAKS_ACILIS. Boş / metin / negatif / ondalık dışı → GECERSIZ_DEGER.
 * - Hub'da pasif / yok / dosyada mükerrer sicil → yazılmaz, raporda.
 * - Kişinin zaten ACILIS hareketi varsa → ZATEN_VAR (anahtar ACILIS:<personel> → iki kez yüklenemez).
 * - Varsayılan DRY-RUN. Apply: eşleşmeyen oranı eşiği (%10) aşarsa DURUR; tek transaction; kısmi yazım yok.
 * - Apply, geçiş tarihini (SystemSetting izin_gecis_tarihi) yazar: o tarihe kadarki yıldönümleri Excel'de
 *   sayılmış kabul edilir, hak ediş işi SONRAKİ yıldönümünden başlar. Ayar varsa ve farklıysa apply DURUR.
 *
 * 'server-only' ve '@/lib/prisma' İMPORT ETMEZ; DB istemcisi parametre olarak gelir.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import type { PrismaClient } from '../../generated/prisma'
import { acilisHareketi } from './bakiye'
import { GUN, IzinGirdiHatasi } from './gun-sayimi'

export const ESLESMEYEN_ESIK_VARSAYILAN = 0.1
export const MAKS_ACILIS = 400
export const GECIS_TARIHI_AYARI = 'izin_gecis_tarihi'
export const YILLIK_KOD = 'YILLIK'

/** "ilr 00207", "ILR00207", " ILR-00207 " → "ILR-00207" (PDKS kart import'uyla aynı kural). */
export function sicilNormalize(s: unknown): string {
  const t = String(s ?? '').trim().toUpperCase().replace(/\s+/g, '')
  const m = /^([A-Z]+)-?(\d+)$/.exec(t)
  return m ? `${m[1]}-${m[2]}` : t
}

// ── Excel ────────────────────────────────────────────────────────────────────

export interface AcilisSatiri {
  satir: number // Excel satır no (1 tabanlı)
  sicil: string
  degerHam: string
}

export interface AcilisOkuma {
  satirlar: AcilisSatiri[]
  baslikSatiri: number
  sicilSutunu: string
  kalanSutunu: string
}

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')

/**
 * İlk sayfa. Başlık satırı "sicil" içeren hücreden bulunur (ilk 30 satır). Kalan sütunu başlığında
 * "kalan" (yoksa "bakiye") geçen İLK sütun. Biçim İV'den gelmeden kesinleşmedi (§8) — sütun adları
 * bu yüzden gevşek; bulunamazsa hangi başlıkların görüldüğü hataya yazılır.
 */
export function acilisExcelOku(kaynak: Buffer | string): AcilisOkuma {
  const wb = typeof kaynak === 'string' ? XLSX.readFile(kaynak, { raw: false }) : XLSX.read(kaynak, { type: 'buffer', raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws || !ws['!ref']) throw new IzinGirdiHatasi('İlk sayfa boş')
  const A = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })

  const bi = A.slice(0, 30).findIndex((r) => (r ?? []).some((v) => norm(v).startsWith('sicil')))
  if (bi < 0) throw new IzinGirdiHatasi('"Sicil" başlığı ilk 30 satırda bulunamadı')
  const baslik = (A[bi] ?? []).map(norm)
  const cSicil = baslik.findIndex((h) => h.startsWith('sicil'))
  let cKalan = baslik.findIndex((h) => h.includes('kalan'))
  if (cKalan < 0) cKalan = baslik.findIndex((h) => h.includes('bakiye'))
  if (cKalan < 0) {
    throw new IzinGirdiHatasi(`"Kalan" ya da "Bakiye" sütunu yok (başlık ${bi + 1}. satır: ${baslik.filter(Boolean).join(' | ')})`)
  }

  const satirlar: AcilisSatiri[] = []
  for (let i = bi + 1; i < A.length; i++) {
    const r = A[i] ?? []
    const sicilHam = String(r[cSicil] ?? '').trim()
    if (!sicilHam) continue
    const v = r[cKalan]
    satirlar.push({ satir: i + 1, sicil: sicilNormalize(sicilHam), degerHam: v === null || v === undefined ? '' : String(v).trim() })
  }
  return {
    satirlar,
    baslikSatiri: bi + 1,
    sicilSutunu: String((A[bi] ?? [])[cSicil] ?? ''),
    kalanSutunu: String((A[bi] ?? [])[cKalan] ?? ''),
  }
}

/** "12" "12,5" "12.5" → sayı; geçersizse neden */
export function kalanCoz(ham: string): { gun: number } | { hata: string } {
  if (!ham) return { hata: 'kalan boş' }
  const t = ham.replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { hata: `sayı değil: "${ham}"` }
  const n = Number(t)
  if (n < 0) return { hata: `negatif: ${ham}` }
  if (Math.abs(n * 2 - Math.round(n * 2)) > 1e-9) return { hata: `0,5'in katı değil: ${ham}` }
  if (n > MAKS_ACILIS) return { hata: `${MAKS_ACILIS} günden fazla: ${ham}` }
  return { gun: Math.round(n * 2) / 2 }
}

// ── Sınıflandırma (SAF) ──────────────────────────────────────────────────────

export type AcilisSinif = 'ESLESEN' | 'ZATEN_VAR' | 'HUBDA_PASIF' | 'HUBDA_YOK' | 'MUKERRER_SICIL' | 'GECERSIZ_DEGER'
export const ACILIS_SINIFLARI: AcilisSinif[] = ['ESLESEN', 'ZATEN_VAR', 'HUBDA_PASIF', 'HUBDA_YOK', 'MUKERRER_SICIL', 'GECERSIZ_DEGER']

export interface HubKisi {
  id: string
  sicilNo: string | null
  adSoyad: string
  aktif: boolean
  departman: string | null
}

export interface AcilisKaydi {
  satir: number
  sicil: string
  degerHam: string
  gun: number | null
  sinif: AcilisSinif
  personel: HubKisi | null
  aciklama: string
}

export interface AcilisSonucu {
  kayitlar: AcilisKaydi[]
  hubAktifDosyadaYok: HubKisi[]
  ozet: Record<AcilisSinif, number>
  toplamGun: number
  eslesmeyen: { pay: number; payda: number; oran: number }
}

export function acilisSiniflandir(satirlar: AcilisSatiri[], personeller: HubKisi[], acilisiOlanlar: ReadonlySet<string>): AcilisSonucu {
  const sayi = new Map<string, number>()
  for (const s of satirlar) sayi.set(s.sicil, (sayi.get(s.sicil) ?? 0) + 1)
  const bySicil = new Map<string, HubKisi>()
  for (const p of personeller) if (p.sicilNo) bySicil.set(sicilNormalize(p.sicilNo), p)

  const kayitlar: AcilisKaydi[] = satirlar.map((s) => {
    const personel = bySicil.get(s.sicil) ?? null
    const c = kalanCoz(s.degerHam)
    const gun = 'gun' in c ? c.gun : null
    const k = (sinif: AcilisSinif, aciklama = ''): AcilisKaydi => ({ satir: s.satir, sicil: s.sicil, degerHam: s.degerHam, gun, sinif, personel, aciklama })
    if ((sayi.get(s.sicil) ?? 0) > 1) return k('MUKERRER_SICIL', `sicil dosyada ${sayi.get(s.sicil)} satırda`)
    if ('hata' in c) return k('GECERSIZ_DEGER', c.hata)
    if (!personel) return k('HUBDA_YOK', "sicil Hub'da yok")
    if (!personel.aktif) return k('HUBDA_PASIF', "Hub'da pasif — açılış yazılmaz")
    if (acilisiOlanlar.has(personel.id)) return k('ZATEN_VAR', 'açılış bakiyesi daha önce yüklenmiş')
    return k('ESLESEN')
  })

  const dosyada = new Set(kayitlar.filter((k) => k.personel).map((k) => k.personel!.id))
  const hubAktifDosyadaYok = personeller
    .filter((p) => p.aktif && !dosyada.has(p.id))
    .sort((a, b) => (a.sicilNo ?? '').localeCompare(b.sicilNo ?? ''))
  const ozet = Object.fromEntries(ACILIS_SINIFLARI.map((c) => [c, 0])) as Record<AcilisSinif, number>
  for (const k of kayitlar) ozet[k.sinif]++
  const toplamGun = kayitlar.filter((k) => k.sinif === 'ESLESEN').reduce((t, k) => t + Math.round(k.gun! * 2), 0) / 2
  // Eşleşmeyen: yazılamayan her satır (ZATEN_VAR hariç — o bilinçli tekrar). Payda: tüm veri satırları.
  const pay = kayitlar.filter((k) => k.sinif !== 'ESLESEN' && k.sinif !== 'ZATEN_VAR').length
  return { kayitlar, hubAktifDosyadaYok, ozet, toplamGun, eslesmeyen: { pay, payda: kayitlar.length, oran: kayitlar.length ? pay / kayitlar.length : 0 } }
}

// ── Rapor (KİŞİ VERİSİ: slot DIŞI IZIN_IMPORT_DIR, dizin 700, dosya 600; public/ ASLA) ─────────
// <repo>/uploads slot başına ayrıdır: ekrandan alınan rapor swap'tan sonra görünmez olurdu. Bu yüzden
// CLI ve ekran aynı ortak dizine yazar (varsayılan /home/rokunet/shared/izin-import).

const csvAlan = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const IZIN_IMPORT_DIR_VARSAYILAN = '/home/rokunet/shared/izin-import'

export function acilisRaporDizini(env: NodeJS.ProcessEnv = process.env) {
  const d = env.IZIN_IMPORT_DIR?.trim() || IZIN_IMPORT_DIR_VARSAYILAN
  if (!path.isAbsolute(d)) throw new Error(`IZIN_IMPORT_DIR mutlak yol olmalı: ${d}`)
  return path.resolve(d)
}

export function acilisRaporYaz(dizin: string, sonuc: AcilisSonucu, meta: Record<string, unknown>, etiket: string): { csv: string; json: string } {
  if (dizin.split(path.sep).includes('public')) throw new Error('rapor public/ altına yazılamaz')
  fs.mkdirSync(dizin, { recursive: true, mode: 0o700 })
  fs.chmodSync(dizin, 0o700) // önceden var olan dizin de daraltılır
  const csv = path.join(dizin, `acilis-${etiket}.csv`)
  const json = path.join(dizin, `acilis-${etiket}.json`)
  const satirlar = [
    'bolum;excel_satir;sicil;dosya_kalan;sinif;hub_durum;hub_ad_soyad;hub_departman;aciklama',
    ...sonuc.kayitlar.map((k) =>
      ['DOSYA', k.satir, k.sicil, k.degerHam, k.sinif, k.personel ? (k.personel.aktif ? 'AKTIF' : 'PASIF') : 'YOK', k.personel?.adSoyad ?? '', k.personel?.departman ?? '', k.aciklama]
        .map(csvAlan)
        .join(';'),
    ),
    ...sonuc.hubAktifDosyadaYok.map((p) =>
      ['HUB_AKTIF_DOSYADA_YOK', '', p.sicilNo ?? '', '', 'HUB_AKTIF_DOSYADA_YOK', 'AKTIF', p.adSoyad, p.departman ?? '', 'dosyada yok — açılış 0 kalır'].map(csvAlan).join(';'),
    ),
  ]
  fs.writeFileSync(csv, '﻿' + satirlar.join('\n') + '\n', { mode: 0o600 })
  fs.writeFileSync(
    json,
    JSON.stringify({ ...meta, ozet: sonuc.ozet, toplamGun: sonuc.toplamGun, eslesmeyen: sonuc.eslesmeyen, hubAktifDosyadaYok: sonuc.hubAktifDosyadaYok.length }, null, 2),
    { mode: 0o600 },
  )
  fs.chmodSync(csv, 0o600)
  fs.chmodSync(json, 0o600)
  return { csv, json }
}

// ── DB ───────────────────────────────────────────────────────────────────────

type Db = Pick<PrismaClient, 'personnel' | 'izinTuru' | 'izinBakiyeHareketi' | 'systemSetting' | 'permissionAuditLog' | '$transaction'>

export async function acilisHubVerisi(db: Db) {
  const [ps, tur, acilis, ayar] = await Promise.all([
    db.personnel.findMany({ select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true, department: { select: { name: true } } } }),
    db.izinTuru.findUnique({ where: { kod: YILLIK_KOD }, select: { id: true } }),
    db.izinBakiyeHareketi.findMany({ where: { hareket: 'ACILIS' }, select: { personnelId: true } }),
    db.systemSetting.findUnique({ where: { key: GECIS_TARIHI_AYARI }, select: { value: true } }),
  ])
  if (!tur) throw new IzinGirdiHatasi('YILLIK izin türü tanımlı değil (Faz 1 seed\'i uygulanmamış)')
  return {
    personeller: ps.map((p) => ({ id: p.id, sicilNo: p.sicilNo, adSoyad: p.adSoyad, aktif: p.aktif, departman: p.department?.name ?? p.bolum ?? null })),
    yillikTurId: tur.id,
    acilisiOlanlar: new Set(acilis.map((a) => a.personnelId)),
    gecisTarihi: ayar?.value ?? null,
  }
}

export function acilisKapisi(sonuc: AcilisSonucu, esik: number): string | null {
  if (sonuc.ozet.ESLESEN === 0) return 'yazılacak satır yok'
  if (sonuc.eslesmeyen.oran > esik) {
    return `eşleşmeyen oranı %${(sonuc.eslesmeyen.oran * 100).toFixed(1)} > eşik %${(esik * 100).toFixed(0)}`
  }
  return null
}

/**
 * ESLESEN satırları yazar — TEK transaction. ACILIS anahtarı tekil: yarışta ikinci yükleme P2002 ile tüm
 * işlemi geri alır. Geçiş tarihi ayarı yoksa yazılır; varsa ve farklıysa işlem DURUR.
 */
export async function acilisUygula(
  db: Db,
  o: { sonuc: AcilisSonucu; tarih: string; yillikTurId: string; aktorId: string; rapor: string; kaynakSha256: string },
): Promise<{ yazilan: number; toplamGun: number }> {
  if (!GUN.test(o.tarih)) throw new IzinGirdiHatasi('Açılış tarihi YYYY-MM-DD olmalı')
  const hedef = o.sonuc.kayitlar.filter((k) => k.sinif === 'ESLESEN')
  return db.$transaction(
    async (tx) => {
      const ayar = await tx.systemSetting.findUnique({ where: { key: GECIS_TARIHI_AYARI }, select: { value: true } })
      if (ayar && ayar.value !== o.tarih) {
        throw new IzinGirdiHatasi(`Geçiş tarihi zaten ${ayar.value} olarak kayıtlı; açılış tarihi (${o.tarih}) farklı — DURDU`)
      }
      if (!ayar) await tx.systemSetting.create({ data: { key: GECIS_TARIHI_AYARI, value: o.tarih, category: 'izin' } })
      const r = await tx.izinBakiyeHareketi.createMany({
        data: hedef.map((k) => {
          const h = acilisHareketi(k.personel!.id, k.gun!, o.tarih)
          return { ...h, personnelId: k.personel!.id, turId: o.yillikTurId, tarih: new Date(`${o.tarih}T00:00:00Z`), olusturanId: o.aktorId }
        }),
      })
      if (r.count !== hedef.length) throw new Error(`beklenen ${hedef.length} satır, yazılan ${r.count} — geri alındı`)
      await tx.permissionAuditLog.create({
        data: {
          action: 'IZIN_ACILIS_IMPORT',
          actorId: o.aktorId,
          targetType: 'IZIN_BAKIYE',
          targetId: '',
          details: { tarih: o.tarih, yazilan: r.count, toplamGun: o.sonuc.toplamGun, ozet: o.sonuc.ozet, rapor: path.basename(o.rapor), kaynakSha256: o.kaynakSha256 },
        },
      })
      return { yazilan: r.count, toplamGun: o.sonuc.toplamGun }
    },
    { timeout: 60_000 },
  )
}
