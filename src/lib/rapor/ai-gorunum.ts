/**
 * Doğal dil → etkileşimli rapor görünümü (Claude, tool use ile yapılandırılmış çıktı).
 *
 * API anahtarı YALNIZ sunucuda: bu modül hiçbir zaman istemciye bundle edilmez
 * (yalnız /api/raporlar/[id]/ai içinden çağrılır). SDK bağımlılığı yok — düz fetch.
 *
 * Akış: bağlam (alanlar + tipler + etiketler + hesaplanan ifadeler + örnek değerler + mevcut
 * görünüm + bugünün tarihi) → tek zorunlu araç "gorunum_kur" → gorunumDogrula → geçmezse
 * hata metni modele bir kez geri verilir → yine geçmezse anlaşılmadı.
 */
import { gorunumDogrula } from './sablon-dogrula'
import type { EtkilesimliIcerik, Gorunum } from './tipler'

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const VARSAYILAN_MODEL = 'claude-sonnet-5'
const ZAMAN_ASIMI_MS = 20_000
export const ISTEK_SINIRI = 500

export interface AiAlan {
  ad: string
  etiket: string | null
  tip: 'metin' | 'sayi' | 'tarih' | string
  hesaplanan?: boolean
  ifade?: string
}

export interface AiGorunumGirdi {
  istek: string
  mevcutGorunum: Gorunum
  alanlar: AiAlan[]
  /** alan → ≤20 farklı değer (istemci gönderir; veri yoksa boş). */
  ornekDegerler?: Record<string, string[]>
  /** Göreli tarih istekleri için referans gün (varsayılan: bugün). */
  bugun?: Date
  model?: string
}

export interface AiGorunumSonuc {
  gorunum: Gorunum | null
  aciklama: string
  anlasilmadi: boolean
  /** Ölçüm/log için. */
  olcum: { girisToken: number; cikisToken: number; sureMs: number; deneme: number; model: string }
}

export class AiYapilandirmaHatasi extends Error {}

// ── Araç şeması (Gorunum'un JSON şeması + açıklama/anlasilmadi) ──────────

const KOLON_SEMA = {
  type: 'object',
  properties: {
    alan: { type: 'string', description: 'Alan adı (verilen listeden birebir)' },
    baslik: { type: 'string', description: 'Kolon başlığı; değiştirmeye gerek yoksa mevcut başlığı koru' },
    gorunur: { type: 'boolean' },
    toplam: { type: 'string', enum: ['topla', 'ortalama', 'say', 'enkucuk', 'enbuyuk'], description: 'Grup/genel toplam satırındaki özet; yalnız sayı alanlarında' },
    bicim: { type: 'string', enum: ['#.##0', '#.##0,00', '%0,0', '%0,00', 'gg.aa.yyyy', 'gg.aa.yyyy ss:dd', 'metin'] },
  },
  required: ['alan', 'gorunur'],
  additionalProperties: false,
} as const

export const GORUNUM_ARACI = {
  name: 'gorunum_kur',
  description: 'Kullanıcının isteğine göre rapor görünümünü kurar. Mevcut görünümün TAMAMINI döndür (değiştirmediğin kolonları da).',
  input_schema: {
    type: 'object',
    properties: {
      anlasilmadi: { type: 'boolean', description: 'İstek bu veri setiyle karşılanamıyorsa true; bu durumda gorunum gönderme, aciklama\'da nedenini yaz.' },
      aciklama: { type: 'string', description: 'Kullanıcıya gösterilecek 1-2 cümlelik Türkçe özet: ne yaptın (veya neden yapamadın).' },
      gorunum: {
        type: 'object',
        properties: {
          kolonlar: { type: 'array', items: KOLON_SEMA },
          gruplar: { type: 'array', items: { type: 'string' }, maxItems: 2, description: 'En fazla 2 seviye, yalnız metin alanları' },
          siralama: {
            type: ['object', 'null'],
            properties: { alan: { type: 'string' }, yon: { type: 'integer', enum: [1, -1], description: '1 artan, -1 azalan' } },
            required: ['alan', 'yon'],
            additionalProperties: false,
          },
          filtreler: { type: 'object', additionalProperties: { type: 'string' }, description: 'alan → süzgeç metni' },
          grafik: {
            type: ['object', 'null'],
            properties: { grupla: { type: 'string', description: 'Kırılım — metin alanı' }, deger: { type: 'string', description: 'Ölçülen sayı alanı' }, fn: { type: 'string', enum: ['topla', 'ortalama'] } },
            required: ['grupla', 'deger', 'fn'],
            additionalProperties: false,
          },
          hesaplananAlanlar: {
            type: 'array',
            items: { type: 'object', properties: { ad: { type: 'string' }, ifade: { type: 'string' }, bicim: { type: 'string' } }, required: ['ad', 'ifade'], additionalProperties: false },
            description: 'Mevcut hesaplanan alanları OLDUĞU GİBİ koru; yenisini ancak gerekiyorsa ekle.',
          },
        },
        required: ['kolonlar', 'gruplar', 'filtreler'],
        additionalProperties: false,
      },
    },
    required: ['anlasilmadi', 'aciklama'],
    additionalProperties: false,
  },
} as const

// ── Sistem mesajı ────────────────────────────────────────────────────────

function isoGun(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

export function sistemMesaji(girdi: AiGorunumGirdi): string {
  const bugun = girdi.bugun ?? new Date()
  const alanSatirlari = girdi.alanlar.map((a) => {
    const parcalar = [`- ${a.ad} (${a.tip})`]
    if (a.etiket) parcalar.push(`etiket: "${a.etiket}"`)
    if (a.hesaplanan) parcalar.push(`hesaplanan, ifade: ${a.ifade}`)
    const ornek = girdi.ornekDegerler?.[a.ad]
    if (ornek?.length) parcalar.push(`değerler: ${ornek.map((v) => `"${v}"`).join(', ')}`)
    return parcalar.join(' · ')
  })

  return [
    'Bir üretim raporu ekranının görünümünü kuruyorsun. Kullanıcı Türkçe yazar; sen gorunum_kur aracını çağırırsın.',
    '',
    'VERİ SETİ ALANLARI (yalnız bunları kullan — başka alan adı UYDURMA):',
    ...alanSatirlari,
    '',
    `BUGÜN: ${isoGun(bugun)} (${GUNLER[bugun.getDay()]})`,
    '',
    'KURALLAR',
    '1. Alan adları yukarıdaki listeden birebir olmalı. Listede olmayan bir şey isteniyorsa anlasilmadi=true.',
    '2. Mevcut görünümün TAMAMINI döndür: değiştirmediğin kolonları, başlıkları, biçimleri ve hesaplanan alanları aynen koru. Kullanıcı "buna ek olarak" diyebilir.',
    '3. Süzgeç sözdizimi (filtreler: alan → metin):',
    '   - metin alanı: aranan parça, büyük/küçük duyarsız "içerir" (ör. durum: "Closed")',
    '   - metin DIŞLAMA: "<> Closed" ya da "!= Closed" → o değeri İÇERMEYENLER.',
    '     "X\'leri gösterme / X hariç / X olmayanlar" isteklerinde BUNU kullan; asla kalan değerlerden',
    '     birini pozitif süzgeç olarak yazma (diğerlerini sessizce gizler).',
    '   - sayı alanı: "< 90", ">= 10", "= 5", "90" (çıplak sayı eşittir)',
    '   - tarih alanı: "< bugün", ">= bugün", "= 2026-09-01", "< 01.09.2026", "bu_hafta", "bu_ay"',
    '   - Süzgeçler VE ile birleşir; bir alana yalnız TEK süzgeç yazılabilir.',
    '   - "Geciken/gecikmiş" = termin/teslim tarihi bugünden önce VE kayıt kapanmamış',
    '     (ör. termin: "< bugün", durum: "<> Closed"). Kapanmışı dışlamak için DIŞLAMA kullan.',
    '4. gruplar: en fazla 2 ve yalnız metin alanları. Sayı/tarih alanına göre gruplama yapma.',
    '5. grafik.grupla metin alanı, grafik.deger sayı alanı olmalı; istenmiyorsa grafik: null bırak.',
    '6. siralama.yon: 1 artan (en düşük üstte), -1 azalan (en yüksek üstte).',
    '7. Bir alanı "göster" demek gorunur: true, "gizle/çıkar" demek gorunur: false. Alanı kolon listesinden SİLME.',
    '8. aciklama Türkçe, 1-2 cümle, kullanıcıya ne yaptığını anlatır (ör. "Tezgaha göre grupladım ve verimi 90\'ın altındakileri süzdüm.").',
    '9. İstek veri setiyle karşılanamıyorsa (olmayan bir ölçü/boyut) anlasilmadi=true ve aciklama\'da hangi alanın bulunmadığını yaz.',
  ].join('\n')
}

// ── Anthropic çağrısı ────────────────────────────────────────────────────

interface AnthropicYanit {
  content: { type: string; name?: string; input?: unknown; text?: string }[]
  usage?: { input_tokens?: number; output_tokens?: number }
  stop_reason?: string
}

type Mesaj = { role: 'user' | 'assistant'; content: unknown }

async function anthropicCagir(model: string, sistem: string, mesajlar: Mesaj[], apiKey: string): Promise<AnthropicYanit> {
  const kontrol = new AbortController()
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS)
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: sistem,
        tools: [GORUNUM_ARACI],
        tool_choice: { type: 'tool', name: GORUNUM_ARACI.name },
        messages: mesajlar,
      }),
      signal: kontrol.signal,
    })
    if (!r.ok) {
      const govde = await r.text().catch(() => '')
      throw new Error(`Anthropic ${r.status}: ${govde.slice(0, 300)}`)
    }
    return (await r.json()) as AnthropicYanit
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(`Yapay zekâ ${ZAMAN_ASIMI_MS / 1000} saniyede yanıt vermedi`)
    throw e
  } finally {
    clearTimeout(zamanlayici)
  }
}

function aracCiktisi(y: AnthropicYanit): { id: string; input: { anlasilmadi?: boolean; aciklama?: string; gorunum?: Gorunum } } | null {
  const blok = y.content?.find((c) => c.type === 'tool_use' && c.name === GORUNUM_ARACI.name) as
    | { id?: string; input?: { anlasilmadi?: boolean; aciklama?: string; gorunum?: Gorunum } }
    | undefined
  if (!blok?.input) return null
  return { id: blok.id ?? '', input: blok.input }
}

/** Modelin döndürdüğü görünümü mevcut görünümle harmanlar: eksik alanlar mevcuttan tamamlanır. */
function gorunumuTamamla(onerilen: Gorunum, mevcut: Gorunum): Gorunum {
  return {
    kolonlar: onerilen.kolonlar?.length ? onerilen.kolonlar : mevcut.kolonlar,
    gruplar: (onerilen.gruplar ?? []).slice(0, 2),
    siralama: onerilen.siralama ?? null,
    filtreler: onerilen.filtreler ?? {},
    grafik: onerilen.grafik ?? null,
    hesaplananAlanlar: onerilen.hesaplananAlanlar ?? mevcut.hesaplananAlanlar ?? [],
  }
}

/**
 * Doğal dil isteğini görünüme çevirir. Doğrulamadan geçemezse hata metnini modele BİR kez
 * geri verir; ikinci denemede de geçemezse anlasilmadi=true döner (mevcut görünüm korunur).
 */
export async function aiGorunumKur(girdi: AiGorunumGirdi): Promise<AiGorunumSonuc> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AiYapilandirmaHatasi('ANTHROPIC_API_KEY tanımlı değil')
  const model = girdi.model ?? process.env.RAPOR_AI_MODEL ?? VARSAYILAN_MODEL

  const istek = girdi.istek.trim().slice(0, ISTEK_SINIRI)
  const sistem = sistemMesaji(girdi)
  const mesajlar: Mesaj[] = [
    { role: 'user', content: `MEVCUT GÖRÜNÜM:\n${JSON.stringify(girdi.mevcutGorunum)}\n\nİSTEK: ${istek}` },
  ]

  const t0 = Date.now()
  let girisToken = 0, cikisToken = 0
  const veriSetiAlanAdlari = girdi.alanlar.filter((a) => !a.hesaplanan).map((a) => a.ad)

  for (let deneme = 1; deneme <= 2; deneme++) {
    const yanit = await anthropicCagir(model, sistem, mesajlar, apiKey)
    girisToken += yanit.usage?.input_tokens ?? 0
    cikisToken += yanit.usage?.output_tokens ?? 0

    const arac = aracCiktisi(yanit)
    const olcum = { girisToken, cikisToken, sureMs: Date.now() - t0, deneme, model }
    if (!arac) {
      return { gorunum: null, aciklama: 'Yapay zekâ bir görünüm üretemedi. İsteği biraz daha somut yazmayı dene.', anlasilmadi: true, olcum }
    }
    const { anlasilmadi, aciklama, gorunum } = arac.input

    if (anlasilmadi || !gorunum) {
      return { gorunum: null, aciklama: aciklama ?? 'Bu istek mevcut veri setiyle karşılanamıyor.', anlasilmadi: true, olcum }
    }

    const tam = gorunumuTamamla(gorunum, girdi.mevcutGorunum)
    const sahteIcerik = { tur: 'etkilesimli', baslik: 'kontrol', gorunum: tam } as EtkilesimliIcerik
    const hatalar = gorunumDogrula(sahteIcerik, veriSetiAlanAdlari)
    if (hatalar.length === 0) {
      return { gorunum: tam, aciklama: aciklama ?? 'Görünüm güncellendi.', anlasilmadi: false, olcum }
    }
    if (deneme === 2) {
      return {
        gorunum: null,
        aciklama: `İstek anlaşıldı ama geçerli bir görünüm kurulamadı (${hatalar[0]}). Farklı bir ifadeyle dener misin?`,
        anlasilmadi: true,
        olcum,
      }
    }
    // Tek düzeltme turu: hatayı araç sonucu olarak geri ver.
    mesajlar.push({ role: 'assistant', content: yanit.content })
    mesajlar.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: arac.id,
          is_error: true,
          content: `Görünüm doğrulamadan geçmedi:\n- ${hatalar.join('\n- ')}\nDüzelt ve gorunum_kur'u tekrar çağır. Alan adları yalnız verilen listeden olmalı.`,
        },
      ],
    })
  }

  throw new Error('ulaşılamaz')
}
