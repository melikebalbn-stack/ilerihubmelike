/**
 * "Bu alan veri setinde yok" → katalogdan ALAN ÖNERİSİ.
 *
 * Doğal dil çubuğu anlasilmadi=true döndüğünde ikinci aşama olarak çalışır: modelin verdiği
 * arama terimleriyle rapor_katalog'da arar (katalog/_ara.ts ile ORTAK arama), en iyi 3 alanı
 * önerir ve her öneri için "hangi anahtar üzerinden birleşir" ipucunu KOD TARAFINDA çıkarır
 * (modele sordurulmaz): ad eşitliği veya birinin diğerinin soneki olması.
 *
 * Sunucu tarafıdır (prisma kullanır); istemciye bundle edilmez.
 */
import { prisma } from '@/lib/prisma'
import { katalogAra, type KatalogAramaAlani } from '@/app/api/raporlar/katalog/_ara'
import { birlestirmeAnahtariMi, enIyiAnahtarEslesmesi, referansMi } from './katalog-siniflama'
import type { VeriSetiTanim } from './tipler'

export interface AlanOnerisi {
  kaynakAd: string
  entity: string
  entityEtiket: string | null
  alan: string
  alanEtiket: string | null
  veriTipi: string
  /** "shopOrd.CustomerOrderNo ↔ CustomerOrder.OrderNo üzerinden birleştirilebilir" — yoksa undefined. */
  baglantiIpucu?: string
}

/** Modelden gelen terim sayısı ve her terim için bakılacak sonuç sayısı sınırlı tutulur. */
const MAX_TERIM = 5
const MAX_ONERI = 3

const kucult = (s: string) => s.toLocaleLowerCase('tr-TR')

/** Veri setindeki IFS kaynaklarının (takma ad, alan) çiftleri — birleştirme ipucu için. */
function mevcutAlanCiftleri(tanim: VeriSetiTanim): { kaynak: string; alan: string }[] {
  const ciftler: { kaynak: string; alan: string }[] = []
  const gorulen = new Set<string>()
  const ekle = (kaynak: string, alan: string) => {
    const anahtar = `${kaynak}.${alan}`
    if (gorulen.has(anahtar)) return
    gorulen.add(anahtar)
    ciftler.push({ kaynak, alan })
  }
  for (const k of tanim.kaynaklar ?? []) {
    if (k.tip === 'ifs-odata') for (const a of k.select ?? []) ekle(k.ad, a)
    else for (const a of k.tasarim?.alanlar ?? []) ekle(k.ad, a)
  }
  // Çıktı eşlemesindeki yollar da sayılır (select'te olmayan bir alan eşlenmiş olabilir).
  for (const yol of Object.values(tanim.alanlar ?? {})) {
    const [kaynak, ...kalan] = yol.split('.')
    if (kaynak && kalan.length) ekle(kaynak, kalan.join('.'))
  }
  return ciftler
}

/** Puan: etiket/ad tam eşleşme > başlangıç > içerir; referans tablolar ve fazla uzun entity'ler geri planda. */
function puan(a: KatalogAramaAlani, terimler: string[]): number {
  const alan = kucult(a.alan)
  const etiket = kucult(a.etiket ?? '')
  const entity = kucult(a.entity)
  const entityEtiket = kucult(a.entityEtiket ?? '')
  let p = 0
  for (const ham of terimler) {
    const t = kucult(ham.trim())
    if (!t) continue
    if (alan === t || etiket === t) p += 100
    else if (etiket.startsWith(t) || alan.startsWith(t)) p += 60
    else if (etiket.includes(t) || alan.includes(t)) p += 40
    if (entity.includes(t) || entityEtiket.includes(t)) p += 15
  }
  if (a.etiket) p += 10 // Türkçeleştirilmiş alan kullanıcıya daha anlaşılır
  if (a.anahtarMi) p += 5
  if (referansMi(a.entity)) p -= 70 // Reference/Lov tabloları geri planda
  if (a.entityAlanSayisi > 0 && a.entityAlanSayisi < 4) p -= 10 // neredeyse boş entity
  return p
}

/**
 * Terimleri katalogda arar, veri setinde ZATEN olan alanları eler, en iyi 3 öneriyi döner.
 * Terim yoksa ya da eşleşme yoksa boş dizi (çağıran mevcut davranışı korur).
 */
export async function alanOnerileri(terimler: string[], tanim: VeriSetiTanim): Promise<AlanOnerisi[]> {
  const temiz = [...new Set((terimler ?? []).map((t) => t.trim()).filter((t) => t.length >= 2))].slice(0, MAX_TERIM)
  if (!temiz.length) return []

  const aramalar = await Promise.all(temiz.map((t) => katalogAra(t, 60)))
  const adaylar = new Map<string, KatalogAramaAlani>()
  for (const a of aramalar) for (const s of a.sonuclar) adaylar.set(`${s.kaynakAd}|${s.entity}|${s.alan}`, s)
  if (!adaylar.size) return []

  // Veri setinde hâlihazırda çekilen (projeksiyon, alan) çiftleri önerilmez.
  const mevcutIfs = new Set<string>()
  for (const k of tanim.kaynaklar ?? []) {
    if (k.tip !== 'ifs-odata') continue
    for (const a of k.select ?? []) mevcutIfs.add(`${k.projeksiyon}|${kucult(a)}`)
  }

  const siralı = [...adaylar.values()]
    .filter((a) => !mevcutIfs.has(`${a.kaynakAd}|${kucult(a.alan)}`))
    .map((a) => ({ a, p: puan(a, temiz) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p || x.a.entity.localeCompare(y.a.entity))

  // Aynı entity'den en fazla 1 öneri — kullanıcıya çeşitli seçenek kalsın.
  const secilen: KatalogAramaAlani[] = []
  const gorulenEntity = new Set<string>()
  for (const { a } of siralı) {
    const e = `${a.kaynakAd}|${a.entity}`
    if (gorulenEntity.has(e)) continue
    gorulenEntity.add(e)
    secilen.push(a)
    if (secilen.length >= MAX_ONERI) break
  }
  if (!secilen.length) return []

  // Bağlantı ipucu: önerilen entity'nin ANAHTAR alanları ile veri setindeki alanlar arasında ad eşleşmesi.
  const anahtarlar = await prisma.raporKatalog.findMany({
    where: { aktif: true, anahtarMi: true, OR: secilen.map((s) => ({ kaynakAd: s.kaynakAd, entity: s.entity })) },
    select: { kaynakAd: true, entity: true, alan: true },
  })
  const mevcut = mevcutAlanCiftleri(tanim)

  return secilen.map((s) => {
    // Site/şirket kolonları anahtar sayılmaz (Contract eşleşmesi ilişki değildir).
    const entityAnahtarlari = anahtarlar.filter((k) => k.kaynakAd === s.kaynakAd && k.entity === s.entity).map((k) => k.alan).filter(birlestirmeAnahtariMi)
    let ipucu: string | undefined
    for (const anahtar of entityAnahtarlari) {
      const eslesen = enIyiAnahtarEslesmesi(mevcut, anahtar, s.entity)
      if (eslesen) {
        ipucu = `${eslesen.kaynak}.${eslesen.alan} ↔ ${s.entity}.${anahtar} üzerinden birleştirilebilir`
        break
      }
    }
    return {
      kaynakAd: s.kaynakAd, entity: s.entity, entityEtiket: s.entityEtiket,
      alan: s.alan, alanEtiket: s.etiket, veriTipi: s.veriTipi,
      ...(ipucu ? { baglantiIpucu: ipucu } : {}),
    }
  })
}
