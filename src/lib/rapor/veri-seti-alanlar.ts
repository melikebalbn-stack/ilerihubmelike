/**
 * Veri setinin çıktı alanları + veri tipi + Türkçe etiket (sunucu). IFS: rapor_katalog (kaynakAd=projeksiyon,
 * alan adı); Hub: information_schema (tasarim.tablo). Bulunamazsa 'metin'. Tasarım ekranı ve etkileşimli
 * rapor sayfası ortak kullanır.
 */
import { prisma } from '@/lib/prisma'
import type { VeriSetiTanim } from './tipler'
import { projeksiyonDegerEtiketleri } from '@/app/api/raporlar/katalog/_degerler'

export interface VeriSetiAlan {
  ad: string
  yol: string
  veriTipi: string
  etiket: string | null
  /** Ham değer → Türkçe gösterim (rapor_katalog_deger). YALNIZ gösterimde kullanılır; süzgeç/ham veri değişmez. */
  degerEtiketleri?: Record<string, string>
}

const PG_TIP: Array<[RegExp, string]> = [[/int|numeric|decimal|real|double|money/i, 'sayi'], [/date|time/i, 'tarih'], [/bool/i, 'mantiksal']]

export async function veriSetiAlanlari(tanim: VeriSetiTanim): Promise<VeriSetiAlan[]> {
  const tipByYol = new Map<string, string>()
  const etiketByYol = new Map<string, string>()
  /** kaynak takma adı → (alan → (ham değer → etiket)) */
  const degerlerByKaynak = new Map<string, Record<string, Record<string, string>>>()
  for (const k of tanim.kaynaklar ?? []) {
    if (k.tip === 'ifs-odata') {
      degerlerByKaynak.set(k.ad, await projeksiyonDegerEtiketleri(k.projeksiyon))
      const satirlar = await prisma.raporKatalog.findMany({ where: { kaynakTipi: 'IFS_ODATA', kaynakAd: k.projeksiyon }, select: { alan: true, veriTipi: true, etiket: true }, distinct: ['alan'] })
      for (const s of satirlar) { tipByYol.set(`${k.ad}.${s.alan}`, s.veriTipi); if (s.etiket) etiketByYol.set(`${k.ad}.${s.alan}`, s.etiket) }
    } else if (k.tasarim?.tablo && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k.tasarim.tablo)) {
      const kolonlar = await prisma.$queryRaw<{ ad: string; tip: string }[]>`SELECT column_name AS "ad", data_type AS "tip" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${k.tasarim.tablo}`
      for (const c of kolonlar) tipByYol.set(`${k.ad}.${c.ad}`, PG_TIP.find(([re]) => re.test(c.tip))?.[1] ?? 'metin')
    }
  }
  return Object.entries(tanim.alanlar ?? {}).map(([ad, yol]) => {
    const [kaynak, ...kalan] = yol.split('.')
    const degerEtiketleri = degerlerByKaynak.get(kaynak)?.[kalan.join('.')]
    return {
      ad, yol,
      veriTipi: tipByYol.get(yol) ?? 'metin',
      etiket: etiketByYol.get(yol) ?? null,
      ...(degerEtiketleri && Object.keys(degerEtiketleri).length ? { degerEtiketleri } : {}),
    }
  })
}
