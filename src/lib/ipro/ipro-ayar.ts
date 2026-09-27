import 'server-only'
import { prisma } from '@/lib/prisma'
import { K, ESIK_TABAN_SN, ESIK_TAVAN_SN, type EsikAyar } from '@/lib/ipro/durus-esik'

// IPRO ayarları (IproAyar) — duruş eşiği çarpan/taban/tavan. 60 sn önbellek (oto-durus her turda okumaz).
// "Çalışıyor" penceresi burada YOK (fiziksel-aktivite.ts sabiti — DOKUNMA).

export const AYAR_CARPAN = 'durus_esik_carpan'
export const AYAR_TABAN = 'durus_esik_taban_sn'
export const AYAR_TAVAN = 'durus_esik_tavan_sn'
export const ESIK_AYAR_ANAHTARLARI = [AYAR_CARPAN, AYAR_TABAN, AYAR_TAVAN] as const

const ONBELLEK_MS = 60_000
let genelCache: { deger: Required<EsikAyar>; ts: number } | null = null

/** Genel eşik ayarları (IproAyar). 60 sn önbellek. Eksik anahtar → durus-esik sabitine düşer. */
export async function esikAyarGetir(): Promise<Required<EsikAyar>> {
  if (genelCache && Date.now() - genelCache.ts < ONBELLEK_MS) return genelCache.deger
  const rows = await prisma.iproAyar.findMany({ where: { anahtar: { in: [...ESIK_AYAR_ANAHTARLARI] } }, select: { anahtar: true, deger: true } })
  const m = new Map(rows.map((r) => [r.anahtar, r.deger]))
  const sayi = (k: string, varsayilan: number) => { const v = Number(m.get(k)); return Number.isFinite(v) && v > 0 ? v : varsayilan }
  const deger: Required<EsikAyar> = {
    carpan: sayi(AYAR_CARPAN, K),
    taban: sayi(AYAR_TABAN, ESIK_TABAN_SN),
    tavan: sayi(AYAR_TAVAN, ESIK_TAVAN_SN),
  }
  genelCache = { deger, ts: Date.now() }
  return deger
}

let tezgahCache: { map: Map<string, { tabanSn: number | null; tavanSn: number | null }>; ts: number } | null = null

/** Tezgah eşiği istisnaları (IproTezgahAyar), tezgahId → {tabanSn, tavanSn}. 60 sn önbellek. */
export async function tezgahEsikMap(): Promise<Map<string, { tabanSn: number | null; tavanSn: number | null }>> {
  if (tezgahCache && Date.now() - tezgahCache.ts < ONBELLEK_MS) return tezgahCache.map
  const rows = await prisma.iproTezgahAyar.findMany({ select: { tezgahId: true, tabanSn: true, tavanSn: true } })
  const map = new Map(rows.map((r) => [r.tezgahId, { tabanSn: r.tabanSn, tavanSn: r.tavanSn }]))
  tezgahCache = { map, ts: Date.now() }
  return map
}

/** Genel ayar + tezgah istisnasını birleştir → esikSaniye'ye verilecek EsikAyar (istisna taban/tavanı ezer). */
export function birlesikEsikAyar(genel: Required<EsikAyar>, istisna?: { tabanSn: number | null; tavanSn: number | null } | null): EsikAyar {
  return {
    carpan: genel.carpan,
    taban: istisna?.tabanSn != null ? istisna.tabanSn : genel.taban,
    tavan: istisna?.tavanSn != null ? istisna.tavanSn : genel.tavan,
  }
}

/** Önbelleği düşür (ayar kaydedilince API çağırır → değişiklik anında geçerli). */
export function ayarOnbellekTemizle(): void {
  genelCache = null
  tezgahCache = null
}

/** Ayar değişikliği denetim kaydı (IproAyarGecmis). */
export async function ayarGecmisYaz(kullaniciId: string | null, alan: string, kayitRef: string | null, eski: string | null, yeni: string | null): Promise<void> {
  await prisma.iproAyarGecmis.create({ data: { kullaniciId, alan, kayitRef, eski, yeni } })
}
