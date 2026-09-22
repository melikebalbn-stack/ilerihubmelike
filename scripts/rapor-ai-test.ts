/**
 * Doğal dil → görünüm (ai-gorunum.ts) canlı API testi — URT-010 "İş Emri Listesi" bağlamıyla.
 *   npx tsx scripts/rapor-ai-test.ts
 *
 * GERÇEK Anthropic çağrısı yapar (.env.local'daki ANTHROPIC_API_KEY). DB'ye/şablona DOKUNMAZ:
 * alanlar ve mevcut görünüm burada sabit tanımlı. Her istek için dönen görünüm, gorunumDogrula
 * sonucu, token ve süre basılır.
 */
import { config } from 'dotenv'
import { aiGorunumKur, type AiAlan } from '../src/lib/rapor/ai-gorunum'
import { gorunumDogrula } from '../src/lib/rapor/sablon-dogrula'
import type { EtkilesimliIcerik, Gorunum } from '../src/lib/rapor/tipler'

config({ path: '.env.local' })
config({ path: '.env' })

// URT-010 veri seti alanları (rapor_veri_seti: is_emri_liste) + hesaplanan verim.
const ALANLAR: AiAlan[] = [
  { ad: 'isEmri', etiket: 'İş Emri No', tip: 'metin' },
  { ad: 'parca', etiket: 'Parça No', tip: 'metin' },
  { ad: 'tezgah', etiket: 'Tezgah', tip: 'metin' },
  { ad: 'durum', etiket: 'Durum', tip: 'metin' },
  { ad: 'planlanan', etiket: 'Planlanan Miktar', tip: 'sayi' },
  { ad: 'tamamlanan', etiket: 'Tamamlanan Miktar', tip: 'sayi' },
  { ad: 'termin', etiket: 'Termin Tarihi', tip: 'tarih' },
  { ad: 'baslangicTarihi', etiket: 'Başlangıç Tarihi', tip: 'tarih' },
  { ad: 'iproIyi', etiket: 'IPRO iyi', tip: 'sayi' },
  { ad: 'iproHurda', etiket: 'IPRO hurda', tip: 'sayi' },
  { ad: 'verim', etiket: null, tip: 'sayi', hesaplanan: true, ifade: '{tamamlanan} / {planlanan} * 100' },
]

const ORNEK_DEGERLER: Record<string, string[]> = {
  durum: ['Planned', 'Released', 'Started', 'Closed'],
  tezgah: ['CNC-01', 'CNC-02', 'TORNA-1', 'PRES-3', 'LAZER-1'],
}

const MEVCUT_GORUNUM: Gorunum = {
  kolonlar: [
    { alan: 'isEmri', baslik: 'İş Emri No', gorunur: true },
    { alan: 'parca', baslik: 'Parça No', gorunur: true },
    { alan: 'tezgah', baslik: 'Tezgah', gorunur: true },
    { alan: 'durum', baslik: 'Durum', gorunur: true },
    { alan: 'planlanan', baslik: 'Planlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
    { alan: 'tamamlanan', baslik: 'Tamamlanan', gorunur: true, toplam: 'topla', bicim: '#.##0' },
    { alan: 'verim', baslik: 'Verim %', gorunur: true, toplam: 'ortalama', bicim: '%0,0' },
    { alan: 'termin', baslik: 'Termin', gorunur: true, bicim: 'gg.aa.yyyy' },
    { alan: 'baslangicTarihi', baslik: 'Başlangıç', gorunur: false, bicim: 'gg.aa.yyyy' },
    { alan: 'iproIyi', baslik: 'IPRO iyi', gorunur: false, toplam: 'topla', bicim: '#.##0' },
    { alan: 'iproHurda', baslik: 'IPRO hurda', gorunur: false, toplam: 'topla', bicim: '#.##0' },
  ],
  gruplar: [],
  siralama: null,
  filtreler: {},
  grafik: { grupla: 'durum', deger: 'planlanan', fn: 'topla' },
  hesaplananAlanlar: [{ ad: 'verim', ifade: '{tamamlanan} / {planlanan} * 100', bicim: '%0,0' }],
}

const VERI_SETI_ALANLARI = ALANLAR.filter((a) => !a.hesaplanan).map((a) => a.ad)

const ISTEKLER: { istek: string; bekleniyor?: 'anlasilmadi' }[] = [
  { istek: 'tezgaha göre grupla' },
  { istek: "verimi 90'ın altında olanlar, en düşük üstte" },
  { istek: 'kapanmış iş emirlerini gösterme' },
  { istek: 'geciken iş emirleri' },
  { istek: 'durum bazında planlanan toplamı grafiği' },
  { istek: 'müşteri bazında ciro', bekleniyor: 'anlasilmadi' },
]

/** Görünümün kullanıcıya görünen özeti — tam JSON yerine okunur satırlar. */
function ozet(g: Gorunum): string[] {
  const satir: string[] = []
  satir.push(`gruplar: ${g.gruplar.length ? g.gruplar.join(' > ') : '—'}`)
  satir.push(`siralama: ${g.siralama ? `${g.siralama.alan} ${g.siralama.yon === 1 ? 'artan' : 'azalan'}` : '—'}`)
  const f = Object.entries(g.filtreler ?? {}).filter(([, v]) => v && v.trim())
  satir.push(`filtreler: ${f.length ? f.map(([a, v]) => `${a} "${v}"`).join(', ') : '—'}`)
  satir.push(`grafik: ${g.grafik ? `${g.grafik.grupla} × ${g.grafik.fn}(${g.grafik.deger})` : '—'}`)
  const gizli = g.kolonlar.filter((k) => !k.gorunur).map((k) => k.alan)
  satir.push(`gizli kolonlar: ${gizli.length ? gizli.join(', ') : '—'}`)
  return satir
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY yok (.env.local) — test çalıştırılamaz.')
    process.exitCode = 1
    return
  }
  console.log(`Model: ${process.env.RAPOR_AI_MODEL ?? 'claude-sonnet-5 (varsayılan)'} · ${ISTEKLER.length} istek\n`)
  let basarisiz = 0

  for (const [i, { istek, bekleniyor }] of ISTEKLER.entries()) {
    console.log(`${'─'.repeat(72)}\n${i + 1}. "${istek}"`)
    try {
      const s = await aiGorunumKur({ istek, mevcutGorunum: MEVCUT_GORUNUM, alanlar: ALANLAR, ornekDegerler: ORNEK_DEGERLER })
      const o = s.olcum
      console.log(`   token: giriş ${o.girisToken} / çıkış ${o.cikisToken} · ${o.sureMs} ms · deneme ${o.deneme}`)
      console.log(`   açıklama: ${s.aciklama}`)

      if (s.anlasilmadi) {
        const dogru = bekleniyor === 'anlasilmadi'
        console.log(`   sonuç: ANLAŞILMADI ${dogru ? '✓ (beklenen)' : '✗ (görünüm bekleniyordu)'}`)
        if (!dogru) basarisiz++
        continue
      }
      if (bekleniyor === 'anlasilmadi') {
        console.log('   sonuç: ✗ anlasilmadi=true beklenirken görünüm döndü')
        basarisiz++
      }
      for (const satir of ozet(s.gorunum!)) console.log(`   ${satir}`)
      const hatalar = gorunumDogrula({ tur: 'etkilesimli', baslik: 'URT-010', gorunum: s.gorunum! } as EtkilesimliIcerik, VERI_SETI_ALANLARI)
      console.log(`   gorunumDogrula: ${hatalar.length === 0 ? '✓ geçti' : `✗ ${hatalar.join('; ')}`}`)
      if (hatalar.length) basarisiz++
    } catch (e) {
      console.log(`   ✗ HATA: ${e instanceof Error ? e.message : String(e)}`)
      basarisiz++
    }
  }

  console.log(`${'─'.repeat(72)}\nSonuç: ${ISTEKLER.length - basarisiz}/${ISTEKLER.length} beklendiği gibi`)
  process.exitCode = basarisiz ? 1 : 0
}

void main()
