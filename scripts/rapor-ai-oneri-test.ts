/**
 * AI alan önerisi testi — GERÇEK Anthropic çağrısı + gerçek katalog (DB).
 *   npx tsx scripts/rapor-ai-oneri-test.ts [veriSetiAdi]
 * Varsayılan bağlam: is_emri_musteri (yoksa ilk IFS veri seti).
 * Her istek için: anlasilmadi, aciklama, terimler, öneri sayısı ve kaynakAd/entity/alan listesi.
 * Not: ANTHROPIC_API_KEY (.env.local) gerektirir; hiçbir şey KAYDETMEZ.
 */
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' }) // ANTHROPIC_API_KEY burada
import { prisma } from '../src/lib/prisma'
import { aiGorunumKur } from '../src/lib/rapor/ai-gorunum'
import { alanOnerileri } from '../src/lib/rapor/alan-onerisi'
import { veriSetiAlanlari } from '../src/lib/rapor/veri-seti-alanlar'
import type { Gorunum, VeriSetiTanim } from '../src/lib/rapor/tipler'

const ISTEKLER = [
  'müşteri isimlerini getir',
  'tedarikçi adını ekle',
  'iş merkezini göster',
  'raporun rengini mavi yap', // öneri ÇIKMAMALI (alan isteği değil)
]

async function main() {
  // Varsayılan bağlam URT-030'un veri seti (adı 'ıs_emri_musteri' — noktasız ı ile kayıtlı).
  const istenenAd = process.argv[2] ?? 'musteri'
  const vs = (await prisma.raporVeriSeti.findFirst({ where: { ad: { contains: istenenAd, mode: 'insensitive' } } }))
    ?? (await prisma.raporVeriSeti.findFirst({ orderBy: { ad: 'asc' } }))
  if (!vs) throw new Error('Veri seti yok')
  const tanim = vs.tanim as unknown as VeriSetiTanim
  const alanlar = await veriSetiAlanlari(tanim)
  console.log(`Veri seti: ${vs.ad} · ${alanlar.length} alan: ${alanlar.map((a) => a.ad).join(', ')}\n`)

  const gorunum: Gorunum = {
    kolonlar: alanlar.map((a) => ({ alan: a.ad, baslik: a.etiket ?? a.ad, gorunur: true })),
    gruplar: [], siralama: null, filtreler: {}, grafik: null, hesaplananAlanlar: [],
  }

  for (const istek of ISTEKLER) {
    const t0 = Date.now()
    const sonuc = await aiGorunumKur({ istek, mevcutGorunum: gorunum, alanlar: alanlar.map((a) => ({ ad: a.ad, etiket: a.etiket, tip: a.veriTipi })) })
    const oneriler = sonuc.anlasilmadi && sonuc.aranacakTerimler.length ? await alanOnerileri(sonuc.aranacakTerimler, tanim) : []
    console.log(`── "${istek}" (${Date.now() - t0} ms)`)
    console.log(`   anlasilmadi: ${sonuc.anlasilmadi}`)
    console.log(`   aciklama   : ${sonuc.aciklama}`)
    console.log(`   terimler   : [${sonuc.aranacakTerimler.join(' | ')}]`)
    console.log(`   öneri      : ${oneriler.length}`)
    for (const o of oneriler) {
      console.log(`     • ${o.kaynakAd} › ${o.entity}.${o.alan}  (${o.entityEtiket ?? '—'} · ${o.alanEtiket ?? '—'} · ${o.veriTipi})`)
      if (o.baglantiIpucu) console.log(`       ↳ ${o.baglantiIpucu}`)
    }
    console.log()
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('HATA:', e); await prisma.$disconnect(); process.exit(1) })
