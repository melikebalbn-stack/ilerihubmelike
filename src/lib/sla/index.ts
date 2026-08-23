// IT Ticket SLA — DB'ye bakan İNCE katman.
//
// Hesap `./calisma-takvimi` içinde (saf, test edilebilir). Burada yalnız
// okuma + cache + varsayılana düşme var. Prisma: '@/lib/prisma' (custom output
// '@/generated/prisma' üzerinden kurulur — '@prisma/client' KULLANILMAZ).

import { prisma } from '@/lib/prisma'
import type { IproTatilTip } from '@/lib/ipro/takvim-util'
import { tarihAnahtari, gecerliTatilTip } from '@/lib/ipro/takvim-util'
import {
  addBusinessMinutes,
  VARSAYILAN_AYAR,
  saatiDakikaya,
  type SlaCalismaAyari,
} from './calisma-takvimi'

export * from './calisma-takvimi'

/** SystemSetting.key — tek JSON değer, category 'sla'. */
export const SLA_AYAR_KEY = 'sla_calisma_takvimi'

// ── Ayar ────────────────────────────────────────────────────────────────────

/** Gelen JSON'u doğrular; tek bir alan bile bozuksa TAMAMI reddedilir. */
function ayariDogrula(ham: unknown): SlaCalismaAyari | null {
  if (typeof ham !== 'object' || ham === null) return null
  const o = ham as Record<string, unknown>

  const bas = typeof o.baslangicSaat === 'string' ? saatiDakikaya(o.baslangicSaat) : null
  const bit = typeof o.bitisSaat === 'string' ? saatiDakikaya(o.bitisSaat) : null
  if (bas === null || bit === null || bit <= bas) return null

  const cd = o.cumartesiDurumu
  if (cd !== 'TAM' && cd !== 'YARIM' && cd !== 'TATIL') return null

  // Opsiyonel saatler: verilmişse GEÇERLİ olmalı (sessizce yutulmaz).
  for (const k of ['ogleAraBaslangic', 'ogleAraBitis', 'cumartesiBitisSaat', 'yarimGunBitisSaat']) {
    const v = o[k]
    if (v !== undefined && v !== null && (typeof v !== 'string' || saatiDakikaya(v) === null)) return null
  }
  // Öğle arası: ya ikisi de var ya hiçbiri.
  const araBas = typeof o.ogleAraBaslangic === 'string' ? o.ogleAraBaslangic : undefined
  const araBit = typeof o.ogleAraBitis === 'string' ? o.ogleAraBitis : undefined
  if ((araBas === undefined) !== (araBit === undefined)) return null
  if (araBas && araBit && saatiDakikaya(araBit)! <= saatiDakikaya(araBas)!) return null

  return {
    baslangicSaat: o.baslangicSaat as string,
    bitisSaat: o.bitisSaat as string,
    ogleAraBaslangic: araBas,
    ogleAraBitis: araBit,
    cumartesiDurumu: cd,
    cumartesiBitisSaat: typeof o.cumartesiBitisSaat === 'string' ? o.cumartesiBitisSaat : undefined,
    yarimGunBitisSaat: typeof o.yarimGunBitisSaat === 'string' ? o.yarimGunBitisSaat : undefined,
  }
}

/**
 * Çalışma takvimi ayarı. Kayıt yoksa/bozuksa VARSAYILAN_AYAR döner ve LOGLAR
 * — sessizce varsayılana düşmek, yanlış SLA'yı fark edilmez kılar.
 */
export async function getSlaAyar(): Promise<SlaCalismaAyari> {
  let kayit: { value: string } | null = null
  try {
    kayit = await prisma.systemSetting.findUnique({
      where: { key: SLA_AYAR_KEY },
      select: { value: true },
    })
  } catch (err) {
    console.error('[sla] SystemSetting okunamadi, varsayilan kullaniliyor:', err)
    return VARSAYILAN_AYAR
  }

  if (!kayit) {
    console.warn(`[sla] '${SLA_AYAR_KEY}' kaydi YOK → varsayilan (08:00-18:00, Cmt tatil)`)
    return VARSAYILAN_AYAR
  }

  let ham: unknown
  try {
    ham = JSON.parse(kayit.value)
  } catch {
    console.error(`[sla] '${SLA_AYAR_KEY}' gecerli JSON degil → varsayilan`)
    return VARSAYILAN_AYAR
  }

  const ayar = ayariDogrula(ham)
  if (!ayar) {
    console.error(`[sla] '${SLA_AYAR_KEY}' icerigi gecersiz → varsayilan`)
    return VARSAYILAN_AYAR
  }
  return ayar
}

// ── Tatil haritası ──────────────────────────────────────────────────────────

const TATIL_CACHE_MS = 5 * 60 * 1000
const tatilCache = new Map<number, { map: Map<string, IproTatilTip>; zaman: number }>()

/** Test/geri-alma için cache'i boşaltır. */
export function tatilCacheTemizle(): void {
  tatilCache.clear()
}

/**
 * Verilen yılların IproTatil istisnaları → 'YYYY-MM-DD' → tip.
 * Pazar BURADA YOK; gunDurumu onu türetir (takvim-util sözleşmesi).
 */
export async function getTatilMap(yillar: number[]): Promise<Map<string, IproTatilTip>> {
  const benzersiz = [...new Set(yillar)].filter((y) => Number.isInteger(y))
  const sonuc = new Map<string, IproTatilTip>()
  const simdi = Date.now()
  const eksik: number[] = []

  for (const y of benzersiz) {
    const c = tatilCache.get(y)
    if (c && simdi - c.zaman < TATIL_CACHE_MS) {
      for (const [k, v] of c.map) sonuc.set(k, v)
    } else {
      eksik.push(y)
    }
  }
  if (eksik.length === 0) return sonuc

  let kayitlar: { tarih: Date; tip: string }[] = []
  try {
    kayitlar = await prisma.iproTatil.findMany({
      where: { yil: { in: eksik } },
      select: { tarih: true, tip: true },
    })
  } catch (err) {
    // Tatil okunamazsa SLA'yı patlatmak yerine "istisna yok" ile devam:
    // Pazar türetmesi yine çalışır, en kötü ihtimalle SLA biraz sıkı olur.
    console.error('[sla] IproTatil okunamadi, istisnasiz devam ediliyor:', err)
    return sonuc
  }

  const yilBazli = new Map<number, Map<string, IproTatilTip>>()
  for (const y of eksik) yilBazli.set(y, new Map())

  for (const k of kayitlar) {
    if (!gecerliTatilTip(k.tip)) {
      console.warn(`[sla] IproTatil gecersiz tip atlandi: ${k.tip}`)
      continue
    }
    const anahtar = tarihAnahtari(k.tarih)
    const yil = Number(anahtar.slice(0, 4))
    yilBazli.get(yil)?.set(anahtar, k.tip)
    sonuc.set(anahtar, k.tip)
  }

  for (const [y, m] of yilBazli) tatilCache.set(y, { map: m, zaman: simdi })
  return sonuc
}

// ── SLA hedefleri ───────────────────────────────────────────────────────────

export interface SlaHedefleri {
  responseDueAt: Date
  resolutionDueAt: Date
}

/**
 * İş dakikası cinsinden SLA hedeflerini hesaplar.
 * Hedefler ÇALIŞMA SAATİ içinde düşer — tatilde/gece biten bir SLA üretilmez.
 */
export async function hesaplaSlaHedefleri(
  createdAt: Date,
  responseMin: number,
  resolutionMin: number,
): Promise<SlaHedefleri> {
  const ayar = await getSlaAyar()

  // Hedef en fazla ~2 ay ileri düşebilir; kapsayıcı olsun diye createdAt yılı + 1.
  const yil = createdAt.getUTCFullYear()
  const tatilMap = await getTatilMap([yil, yil + 1])

  return {
    responseDueAt: addBusinessMinutes(createdAt, responseMin, tatilMap, ayar),
    resolutionDueAt: addBusinessMinutes(createdAt, resolutionMin, tatilMap, ayar),
  }
}

// ── Öncelik tabanı + SLA dakika zinciri ─────────────────────────────────────

export interface SlaDakikalari {
  responseMin: number
  resolutionMin: number
}

/**
 * Öncelik tabanı — İŞ dakikası.
 *
 * Bu tablo `src/app/api/tickets/route.ts` içindeki eski `calculateSLA`'nın
 * yerini alır. Rakamlar TAKVİM dakikasından İŞ dakikasına çevrildi: eskiden
 * NORMAL çözüm 1440dk (=24 takvim saati) idi, artık 1080dk (=2 iş günü,
 * 540dk/gün). Kritik/yüksek eşikleri aynı gün içinde kaldığı için değişmedi.
 *
 * Anahtarlar TicketPriority enum değerleridir (TICKET_ önekine dikkat).
 */
export const ONCELIK_SLA: Record<string, SlaDakikalari> = {
  TICKET_CRITICAL: { responseMin: 15, resolutionMin: 120 },
  TICKET_HIGH: { responseMin: 60, resolutionMin: 480 },
  NORMAL: { responseMin: 240, resolutionMin: 1080 },
  TICKET_LOW: { responseMin: 480, resolutionMin: 2160 },
}

/** Kategoriden okunan ham SLA alanları (Prisma select ile birebir). */
export interface KategoriSlaAlanlari {
  slaResponseMinutes: number | null
  slaResolutionMinutes: number | null
}

/**
 * SLA dakikalarını belirler: KATEGORİ değeri varsa o, yoksa ÖNCELİK tabanı.
 *
 * Yanıt ve çözüm BAĞIMSIZ düşer — kategori yalnız birini tanımlamışsa diğeri
 * önceliğe düşer, ikisi birden reddedilmez.
 * Sıfır ve negatif değerler yok sayılır: 0 dakikalık SLA anlamlı bir hedef
 * değil, veri girişi hatasıdır ve sessizce "her ticket ihlalde" üretirdi.
 */
export function cozumSlaDakika(
  kategori: KategoriSlaAlanlari | null | undefined,
  priority: string | null | undefined,
): SlaDakikalari {
  const taban = ONCELIK_SLA[priority ?? ''] ?? ONCELIK_SLA.NORMAL

  const gecerli = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0

  return {
    responseMin: gecerli(kategori?.slaResponseMinutes) ? kategori!.slaResponseMinutes! : taban.responseMin,
    resolutionMin: gecerli(kategori?.slaResolutionMinutes) ? kategori!.slaResolutionMinutes! : taban.resolutionMin,
  }
}
