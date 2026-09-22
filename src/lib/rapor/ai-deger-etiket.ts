/**
 * Katalog değerlerinin toplu Türkçeleştirilmesi (Claude, tool use ile yapılandırılmış çıktı).
 *
 * API anahtarı YALNIZ sunucuda: bu modül istemciye bundle edilmez (yalnız
 * /api/raporlar/katalog/degerler/ai içinden çağrılır). SDK yok — düz fetch, ai-gorunum.ts ile aynı desen.
 *
 * Model DEĞERLERİ DEĞİŞTİREMEZ: dönen her çeviri, gönderilen ham değer listesiyle karşılaştırılır;
 * listede olmayan değer atılır, eksik kalanlar etiketsiz bırakılır.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const VARSAYILAN_MODEL = 'claude-sonnet-5'
const ZAMAN_ASIMI_MS = 30_000
/** Tek çağrıda gönderilecek en fazla değer (alanlar birleştirilirken de geçerli). */
export const MAX_DEGER = 200

export class AiYapilandirmaHatasi extends Error {}

export interface AiDegerAlani {
  kaynakAd: string
  entity: string
  entityEtiket?: string | null
  alan: string
  alanEtiket?: string | null
  enumTipi?: string | null
  /** Ham değerler — yalnız etiketi olmayan/yenilenecek olanlar gönderilir. */
  degerler: string[]
}

export interface AiDegerSonucu {
  /** kaynakAd|entity|alan → { ham değer → önerilen etiket } */
  cevriler: Record<string, Record<string, string>>
  olcum: { girisToken: number; cikisToken: number; sureMs: number; model: string }
}

export const ETIKET_ARACI = {
  name: 'etiketleri_uret',
  description: 'Verilen IFS alan değerleri için kısa Türkçe etiketler üretir. Değerleri DEĞİŞTİRME, yalnız etiket yaz.',
  input_schema: {
    type: 'object',
    properties: {
      cevriler: {
        type: 'array',
        description: 'Gönderilen her değer için bir satır. Değeri birebir geri yaz.',
        items: {
          type: 'object',
          properties: {
            alanAnahtari: { type: 'string', description: 'Değerin ait olduğu alanın anahtarı (verilen listedeki "anahtar" değeri, birebir)' },
            deger: { type: 'string', description: 'Ham değer — birebir, değiştirmeden' },
            etiket: { type: 'string', description: 'Kısa Türkçe karşılık (1-3 kelime)' },
          },
          required: ['alanAnahtari', 'deger', 'etiket'],
          additionalProperties: false,
        },
      },
    },
    required: ['cevriler'],
    additionalProperties: false,
  },
} as const

export const SISTEM_MESAJI = [
  'IFS Cloud ERP üretim/lojistik terminolojisi. Kısa, Türkçe, iş dilinde.',
  'Örn: Released → Serbest bırakıldı, CompletelyIssued → Tamamen çıkıldı.',
  'Değerleri DEĞİŞTİRME, sadece etiket üret.',
  '',
  'KURALLAR',
  '- Her değer için tam bir satır döndür: alanAnahtari + deger (birebir) + etiket.',
  '- Etiket 1-3 kelime, cümle değil, sonunda nokta yok.',
  '- Alan bağlamını (entity ve alan adı/etiketi) dikkate al: aynı kelime farklı alanda farklı karşılık alabilir.',
  '- Kısaltma/kod gibi görünen ve Türkçesi anlamsız olacak değerleri (ör. "A1", "EA") olduğu gibi bırak.',
  '- Uydurma değer EKLEME; verilmeyen bir değer için satır döndürme.',
].join('\n')

export const alanAnahtari = (a: { kaynakAd: string; entity: string; alan: string }) => `${a.kaynakAd}|${a.entity}|${a.alan}`

export function kullaniciMesaji(alanlar: AiDegerAlani[]): string {
  return alanlar
    .map((a) => {
      const basliklar = [
        `anahtar: ${alanAnahtari(a)}`,
        `entity: ${a.entity}${a.entityEtiket ? ` (${a.entityEtiket})` : ''}`,
        `alan: ${a.alan}${a.alanEtiket ? ` (${a.alanEtiket})` : ''}`,
        a.enumTipi ? `enum tipi: ${a.enumTipi}` : null,
      ].filter(Boolean).join(' · ')
      return `${basliklar}\ndeğerler: ${a.degerler.join(', ')}`
    })
    .join('\n\n')
}

interface AnthropicYanit {
  content: { type: string; name?: string; input?: unknown }[]
  usage?: { input_tokens?: number; output_tokens?: number }
}

async function anthropicCagir(model: string, sistem: string, mesaj: string, apiKey: string): Promise<AnthropicYanit> {
  const kontrol = new AbortController()
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS)
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: sistem,
        tools: [ETIKET_ARACI],
        tool_choice: { type: 'tool', name: ETIKET_ARACI.name },
        messages: [{ role: 'user', content: mesaj }],
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

/** Değerleri Türkçeleştirir. Dönen etiketler yalnız gönderilen ham değerlerle eşleşenlerdir. */
export async function aiDegerEtiketle(alanlar: AiDegerAlani[], model?: string): Promise<AiDegerSonucu> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AiYapilandirmaHatasi('ANTHROPIC_API_KEY tanımlı değil')
  const kullanilanModel = model ?? process.env.RAPOR_AI_MODEL ?? VARSAYILAN_MODEL
  const t0 = Date.now()
  const bos: AiDegerSonucu = { cevriler: {}, olcum: { girisToken: 0, cikisToken: 0, sureMs: 0, model: kullanilanModel } }
  const dolu = alanlar.filter((a) => a.degerler.length)
  if (!dolu.length) return bos

  const yanit = await anthropicCagir(kullanilanModel, SISTEM_MESAJI, kullaniciMesaji(dolu), apiKey)
  const blok = yanit.content?.find((c) => c.type === 'tool_use' && c.name === ETIKET_ARACI.name) as
    | { input?: { cevriler?: { alanAnahtari?: string; deger?: string; etiket?: string }[] } }
    | undefined

  // Yalnız gönderilen (alan, değer) çiftleri kabul edilir — model değer uyduramaz/değiştiremez.
  const izinli = new Map(dolu.map((a) => [alanAnahtari(a), new Set(a.degerler)]))
  const cevriler: Record<string, Record<string, string>> = {}
  for (const c of blok?.input?.cevriler ?? []) {
    const anahtar = c.alanAnahtari ?? ''
    const etiket = (c.etiket ?? '').trim()
    if (!c.deger || !etiket || !izinli.get(anahtar)?.has(c.deger)) continue
    ;(cevriler[anahtar] ??= {})[c.deger] = etiket.slice(0, 120)
  }
  return { cevriler, olcum: { girisToken: yanit.usage?.input_tokens ?? 0, cikisToken: yanit.usage?.output_tokens ?? 0, sureMs: Date.now() - t0, model: kullanilanModel } }
}
