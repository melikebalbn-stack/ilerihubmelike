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

async function ifsCek(k: KaynakIfs, p: RaporParametreler): Promise<Satir[]> {
  if (!/^[A-Za-z0-9_]+$/.test(k.projeksiyon) || !/^[A-Za-z0-9_]+$/.test(k.entitySet)) {
    throw new VeriSetiHatasi(`${k.ad}: geçersiz projeksiyon/entitySet adı`)
  }
  const top = Math.min(Math.max(1, k.top ?? TOP_VARSAYILAN), TOP_UST_SINIR)
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

async function postgresCek(k: KaynakPostgres, p: RaporParametreler): Promise<Satir[]> {
  const degerler = postgresParametreleri(k.parametreler, p)
  return prisma.$queryRawUnsafe<Satir[]>(k.sorgu, ...degerler)
}

async function kaynakCek(k: Kaynak, p: RaporParametreler): Promise<{ ad: string; satirlar: Satir[]; sureMs: number }> {
  const t0 = Date.now()
  const satirlar = k.tip === 'ifs-odata' ? await ifsCek(k, p) : await postgresCek(k, p)
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

// ── Giriş noktası ────────────────────────────────────────────────────────

export async function veriSetiCalistir(tanim: VeriSetiTanim, parametreler: RaporParametreler = {}): Promise<VeriSetiSonuc> {
  const t0 = Date.now()
  if (!tanim.kaynaklar?.length) throw new VeriSetiHatasi('Veri setinde kaynak yok')
  const adlar = new Set<string>()
  for (const k of tanim.kaynaklar) {
    if (adlar.has(k.ad)) throw new VeriSetiHatasi(`Kaynak adı mükerrer: '${k.ad}'`)
    adlar.add(k.ad)
  }

  // Kaynaklar paralel.
  const sonuclar = await Promise.all(tanim.kaynaklar.map((k) => kaynakCek(k, parametreler)))
  const satirlarByAd = new Map(sonuclar.map((s) => [s.ad, s.satirlar]))
  const kaynakIstatistik: KaynakIstatistik[] = sonuclar.map((s) => ({ ad: s.ad, satir: s.satirlar.length, sureMs: s.sureMs }))

  // İlk kaynak taban; birleştirmeler sırayla.
  const tabanAd = tanim.kaynaklar[0].ad
  let bilesik: BilesikSatir[] = (satirlarByAd.get(tabanAd) ?? []).map((s) => ({ [tabanAd]: s }))
  const birlesmis = new Set<string>([tabanAd])
  for (const b of tanim.birlestir ?? []) {
    const sagAd = yolAyir(b.sag, 'birlestir.sag').kaynak
    const sagSatirlar = satirlarByAd.get(sagAd)
    if (!sagSatirlar) throw new VeriSetiHatasi(`birlestir: bilinmeyen sağ kaynak '${sagAd}'`)
    bilesik = birlestir(bilesik, b, sagSatirlar, birlesmis)
  }
  const birlesmeyen = [...adlar].filter((a) => !birlesmis.has(a))
  if (birlesmeyen.length) throw new VeriSetiHatasi(`Birleştirmeye girmeyen kaynak(lar): ${birlesmeyen.join(', ')}`)

  const satirlar = alanlariEsle(bilesik, tanim.alanlar ?? {}, adlar)
  return { satirlar, kaynakIstatistik, toplamSureMs: Date.now() - t0 }
}
