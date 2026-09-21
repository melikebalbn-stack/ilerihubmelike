/**
 * Rapor motoru — veri seti çalıştırıcı. Saf katman: tanımı parametre olarak alır,
 * kaynakları paralel çeker, bellekte birleştirir, alan eşlemesini uygular.
 * Veri seti tanımını DB'den okumaz/yazmaz.
 *
 * IFS: personel-sync/ifs-api.ts `istek()` (token + mainRoot). Postgres: $queryRawUnsafe —
 * sorgu metni tanımdan (rapor.tasarla izinli güvenilir kaynak), değerler DAİMA $n ile.
 */
import { prisma } from '@/lib/prisma'
import { ifsBaglanti, istek, type IfsCevap } from '@/lib/ifs/personel-sync/ifs-api'
import { filtreCoz, postgresParametreleri } from './parametre'
import type { Birlestirme, Kaynak, KaynakIfs, KaynakPostgres, KaynakIstatistik, RaporParametreler, VeriSetiSonuc, VeriSetiTanim } from './tipler'

export class VeriSetiHatasi extends Error {
  constructor(mesaj: string) { super(mesaj); this.name = 'VeriSetiHatasi' }
}

type Satir = Record<string, unknown>
/** Birleşik satır: kaynak adı → o kaynağın satırı (left eşleşmezse null). */
type BilesikSatir = Record<string, Satir | null>

const TOP_VARSAYILAN = 500
const TOP_UST_SINIR = 5000

// ── Kaynak çekme ─────────────────────────────────────────────────────────

async function ifsCek(k: KaynakIfs, p: RaporParametreler, topSinir = TOP_UST_SINIR): Promise<Satir[]> {
  if (!/^[A-Za-z0-9_]+$/.test(k.projeksiyon) || !/^[A-Za-z0-9_]+$/.test(k.entitySet)) {
    throw new VeriSetiHatasi(`${k.ad}: geçersiz projeksiyon/entitySet adı`)
  }
  const top = Math.min(Math.max(1, k.top ?? TOP_VARSAYILAN), topSinir)
  const qs: string[] = []
  if (k.select?.length) qs.push(`$select=${k.select.join(',')}`)
  if (k.filtre) qs.push(`$filter=${encodeURIComponent(filtreCoz(k.filtre, p))}`)
  qs.push(`$top=${top}`)

  // IFS sayfa boyutunu $top'tan küçük tutabilir → nextLink'i top'a ulaşana dek izle.
  const out: Satir[] = []
  const { mainRoot } = ifsBaglanti()
  let yol: string | null = `${k.projeksiyon}.svc/${k.entitySet}?${qs.join('&')}`
  while (yol && out.length < top) {
    // Tip açıklamaları: yol → cevap → nl → yol döngüsel çıkarım TS7022 veriyordu.
    type Sayfa = { value?: Satir[]; '@odata.nextLink'?: string }
    const cevap: IfsCevap<Sayfa> = await istek<Sayfa>(yol)
    for (const ham of cevap.body.value ?? []) {
      if (out.length >= top) break
      out.push(odataAlanlariAt(ham))
    }
    const nl: string | undefined = cevap.body['@odata.nextLink']
    yol = nl ? nl.replace(mainRoot, '') : null
  }
  return out
}

function odataAlanlariAt(ham: Satir): Satir {
  const s: Satir = {}
  for (const [a, v] of Object.entries(ham)) if (!a.startsWith('@odata')) s[a] = v
  return s
}

// ── Postgres güvenli çalıştırma ─────────────────────────────────────────

const SQL_ZAMAN_ASIMI = '30s'

/**
 * Sorgu metni denetimi (kayıt + çalıştırma öncesi): yalnız SELECT/WITH, tek ifade (noktalı virgül yok).
 * Hata mesajı döner; geçerliyse null. Sondaki tek ';' tolere edilir.
 */
export function sqlDenetle(sorgu: string): string | null {
  const s = sorgu.trim().replace(/;\s*$/, '')
  if (!s) return 'SQL sorgusu boş'
  if (!/^(select|with)\b/i.test(s)) return 'yalnız SELECT/WITH sorgusu kabul edilir'
  // Yorum/dize içindeki ';' ayırt edilmez — bilinçli: birden çok ifade riskine karşı tamamı reddedilir.
  if (s.includes(';')) return 'noktalı virgülle birden fazla ifade kabul edilmez'
  return null
}

/**
 * Sorguyu READ ONLY + statement_timeout'lu bir işlem içinde koşturur — önizleme, rapor çalıştırma ve
 * şablon önizleme aynı yoldan geçer. Salt okuma işlemi CTE içine gömülü UPDATE/DELETE'i de keser
 * ("cannot execute … in a read-only transaction"); zaman aşımı pg_sleep gibi uzun sorguları 30 sn'de öldürür.
 * Değerler DAİMA $n parametresiyle bağlanır.
 */
export async function postgresSorguCalistir(sorgu: string, degerler: unknown[]): Promise<Satir[]> {
  const hata = sqlDenetle(sorgu)
  if (hata) throw new VeriSetiHatasi(`SQL: ${hata}`)
  const temiz = sorgu.trim().replace(/;\s*$/, '')
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '${SQL_ZAMAN_ASIMI}'`)
    return tx.$queryRawUnsafe<Satir[]>(temiz, ...degerler)
  }, { timeout: 35_000 })
}

async function postgresCek(k: KaynakPostgres, p: RaporParametreler): Promise<Satir[]> {
  const degerler = postgresParametreleri(k.parametreler, p)
  return postgresSorguCalistir(k.sorgu, degerler)
}

async function kaynakCek(k: Kaynak, p: RaporParametreler, sec: CalistirmaSecenekleri): Promise<{ ad: string; satirlar: Satir[]; sureMs: number }> {
  const t0 = Date.now()
  const satirlar = k.tip === 'ifs-odata' ? await ifsCek(k, p, sec.ifsTopSinir) : await postgresCek(k, p)
  return { ad: k.ad, satirlar, sureMs: Date.now() - t0 }
}

// ── Birleştirme ──────────────────────────────────────────────────────────

function yolAyir(yol: string, baglam: string): { kaynak: string; alan: string } {
  const i = yol.indexOf('.')
  if (i <= 0 || i === yol.length - 1) throw new VeriSetiHatasi(`${baglam}: '${yol}' 'kaynakAd.alan' biçiminde olmalı`)
  return { kaynak: yol.slice(0, i), alan: yol.slice(i + 1) }
}

/** IFS/Postgres tip farkına dayanıklı eşleşme anahtarı; null/undefined eşleşmez. */
function anahtar(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return String(v).trim()
}

function birlestir(taban: BilesikSatir[], b: Birlestirme, sagSatirlar: Satir[], birlesmis: Set<string>): BilesikSatir[] {
  const sol = yolAyir(b.sol, 'birlestir.sol')
  const sag = yolAyir(b.sag, 'birlestir.sag')
  if (!birlesmis.has(sol.kaynak)) throw new VeriSetiHatasi(`birlestir: sol kaynak '${sol.kaynak}' henüz birleşmemiş (sıra hatası?)`)
  if (birlesmis.has(sag.kaynak)) throw new VeriSetiHatasi(`birlestir: sağ kaynak '${sag.kaynak}' zaten birleşmiş`)

  // O(n): sağ tarafı anahtar → satırlar (1:N olabilir) olarak indeksle.
  const indeks = new Map<string, Satir[]>()
  for (const s of sagSatirlar) {
    const k = anahtar(s[sag.alan])
    if (k === null) continue
    const liste = indeks.get(k)
    if (liste) liste.push(s); else indeks.set(k, [s])
  }

  const out: BilesikSatir[] = []
  for (const t of taban) {
    const k = anahtar(t[sol.kaynak]?.[sol.alan])
    const esler = k === null ? undefined : indeks.get(k)
    if (esler?.length) {
      for (const e of esler) out.push({ ...t, [sag.kaynak]: e })
    } else if (b.tip === 'left') {
      out.push({ ...t, [sag.kaynak]: null })
    }
  }
  birlesmis.add(sag.kaynak)
  return out
}

// ── Alan eşlemesi ────────────────────────────────────────────────────────

function alanlariEsle(satirlar: BilesikSatir[], alanlar: Record<string, string>, kaynakAdlari: Set<string>): Satir[] {
  const esleme = Object.entries(alanlar).map(([cikti, yol]) => {
    const { kaynak, alan } = yolAyir(yol, `alanlar.${cikti}`)
    if (!kaynakAdlari.has(kaynak)) throw new VeriSetiHatasi(`alanlar.${cikti}: bilinmeyen kaynak '${kaynak}'`)
    return { cikti, kaynak, alan }
  })
  return satirlar.map((s) => {
    const o: Satir = {}
    for (const e of esleme) o[e.cikti] = s[e.kaynak]?.[e.alan] ?? null
    return o
  })
}

// ── Statik doğrulama (kaydetme + çalıştırma öncesi) ─────────────────────

const AD_DESENI = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface CalistirmaSecenekleri {
  /** IFS $top üst sınırı (önizleme için küçültülür). Varsayılan 5000. */
  ifsTopSinir?: number
}

/**
 * Tanımı veri çekmeden denetler; hata mesajı listesi döner (boş = geçerli).
 * Kural seti veriSetiCalistir ile aynı: mükerrer/geçersiz kaynak adı, IFS ad biçimleri,
 * birleştirme yolları ve sırası, birleştirmeye girmeyen kaynak, alan eşlemesi.
 */
export function tanimDogrula(tanim: VeriSetiTanim): string[] {
  const h: string[] = []
  if (!tanim || !Array.isArray(tanim.kaynaklar) || !tanim.kaynaklar.length) return ['Veri setinde en az bir kaynak olmalı']
  const adlar = new Set<string>()
  for (const k of tanim.kaynaklar) {
    if (!k.ad || !AD_DESENI.test(k.ad)) h.push(`Kaynak adı geçersiz: '${k.ad ?? ''}' (harf/rakam/alt çizgi, harfle başlamalı)`)
    else if (adlar.has(k.ad)) h.push(`Kaynak adı mükerrer: '${k.ad}'`)
    adlar.add(k.ad)
    if (k.tip === 'ifs-odata') {
      if (!/^[A-Za-z0-9_]+$/.test(k.projeksiyon ?? '')) h.push(`${k.ad}: projeksiyon adı geçersiz`)
      if (!/^[A-Za-z0-9_]+$/.test(k.entitySet ?? '')) h.push(`${k.ad}: entity set adı geçersiz`)
    } else if (k.tip === 'postgres') {
      const sqlHata = sqlDenetle(k.sorgu ?? '')
      if (sqlHata) h.push(`${k.ad}: ${sqlHata}`)
      const n = (k.parametreler ?? []).length
      const enBuyuk = Math.max(0, ...[...(k.sorgu ?? '').matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))
      if (enBuyuk > n) h.push(`${k.ad}: sorguda $${enBuyuk} var ama ${n} parametre tanımlı`)
    } else {
      h.push(`Bilinmeyen kaynak tipi: '${(k as { tip?: string }).tip ?? ''}'`)
    }
  }
  const yol = (y: string, baglam: string): { kaynak: string; alan: string } | null => {
    const i = (y ?? '').indexOf('.')
    if (i <= 0 || i === y.length - 1) { h.push(`${baglam}: '${y ?? ''}' 'kaynakAd.alan' biçiminde olmalı`); return null }
    const r = { kaynak: y.slice(0, i), alan: y.slice(i + 1) }
    if (!adlar.has(r.kaynak)) { h.push(`${baglam}: bilinmeyen kaynak '${r.kaynak}'`); return null }
    return r
  }
  const birlesmis = new Set<string>([tanim.kaynaklar[0].ad])
  for (const b of tanim.birlestir ?? []) {
    const sol = yol(b.sol, 'birleştirme sol'), sag = yol(b.sag, 'birleştirme sağ')
    if (b.tip !== 'inner' && b.tip !== 'left') h.push(`birleştirme tipi geçersiz: '${b.tip}'`)
    if (sol && !birlesmis.has(sol.kaynak)) h.push(`birleştirme: sol kaynak '${sol.kaynak}' henüz birleşmemiş (sıra hatası)`)
    if (sag && birlesmis.has(sag.kaynak)) h.push(`birleştirme: sağ kaynak '${sag.kaynak}' zaten birleşmiş`)
    if (sag) birlesmis.add(sag.kaynak)
  }
  const birlesmeyen = [...adlar].filter((a) => !birlesmis.has(a))
  if (birlesmeyen.length) h.push(`Birleştirmeye girmeyen kaynak(lar): ${birlesmeyen.join(', ')}`)
  const alanlar = tanim.alanlar ?? {}
  if (!Object.keys(alanlar).length) h.push('Çıktı alanı tanımlanmamış (alanlar boş)')
  for (const [cikti, y] of Object.entries(alanlar)) {
    if (!AD_DESENI.test(cikti)) h.push(`Çıktı alan adı geçersiz: '${cikti}'`)
    yol(y, `alanlar.${cikti}`)
  }
  return h
}

// ── Giriş noktası ────────────────────────────────────────────────────────

export async function veriSetiCalistir(tanim: VeriSetiTanim, parametreler: RaporParametreler = {}, secenekler: CalistirmaSecenekleri = {}): Promise<VeriSetiSonuc> {
  const t0 = Date.now()
  const hatalar = tanimDogrula(tanim)
  if (hatalar.length) throw new VeriSetiHatasi(hatalar.join('; '))
  const adlar = new Set(tanim.kaynaklar.map((k) => k.ad))

  // Kaynaklar paralel.
  const sonuclar = await Promise.all(tanim.kaynaklar.map((k) => kaynakCek(k, parametreler, secenekler)))
  const satirlarByAd = new Map(sonuclar.map((s) => [s.ad, s.satirlar]))
  const kaynakIstatistik: KaynakIstatistik[] = sonuclar.map((s) => ({ ad: s.ad, satir: s.satirlar.length, sureMs: s.sureMs }))

  // İlk kaynak taban; birleştirmeler sırayla (sıra/varlık denetimi tanimDogrula'da yapıldı).
  const tabanAd = tanim.kaynaklar[0].ad
  let bilesik: BilesikSatir[] = (satirlarByAd.get(tabanAd) ?? []).map((s) => ({ [tabanAd]: s }))
  const birlesmis = new Set<string>([tabanAd])
  for (const b of tanim.birlestir ?? []) {
    const sagAd = yolAyir(b.sag, 'birlestir.sag').kaynak
    bilesik = birlestir(bilesik, b, satirlarByAd.get(sagAd) ?? [], birlesmis)
  }

  const satirlar = alanlariEsle(bilesik, tanim.alanlar ?? {}, adlar)
  return { satirlar, kaynakIstatistik, toplamSureMs: Date.now() - t0 }
}
