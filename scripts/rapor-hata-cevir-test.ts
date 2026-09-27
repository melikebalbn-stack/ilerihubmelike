/**
 * hata-cevir.ts testi — saf, ağ/DB yok.
 *   npx tsx scripts/rapor-hata-cevir-test.ts
 * Ham metinler gerçek IFS/Postgres/Anthropic yanıtlarından (ve bu projedeki hata sarmalayıcılarından).
 */
import { hataCevir, durumCevir, type CevrilmisHata } from '../src/lib/rapor/hata-cevir'
import type { HataBaglami } from '../src/lib/rapor/hata-cevir'

let ok = 0, hata = 0
const test = (ad: string, kosul: boolean, detay?: unknown) => { kosul ? ok++ : hata++; console.log(`   ${kosul ? '✓' : '✗'} ${ad}${kosul ? '' : `  → ${JSON.stringify(detay)?.slice(0, 200)}`}`) }

function bas(baslikMetni: string, ham: string, c: CevrilmisHata) {
  console.log(`\n── ${baslikMetni}`)
  console.log(`   ham      : ${ham.replace(/\s+/g, ' ').slice(0, 150)}${ham.length > 150 ? '…' : ''}`)
  console.log(`   [${c.agirlik === 'hata' ? 'KIRMIZI' : 'SARI'}] ${c.baslik}`)
  console.log(`   açıklama : ${c.aciklama}`)
  if (c.cozum) console.log(`   çözüm    : ${c.cozum}`)
  console.log(`   detay    : ${c.teknikDetay.replace(/\s+/g, ' ').slice(0, 80)}…`)
}

function dene(ad: string, ham: string, baglam: HataBaglami, beklenen: { baslik?: RegExp; cozum?: RegExp; agirlik?: 'hata' | 'uyari' }) {
  const c = hataCevir(ham, baglam)
  bas(ad, ham, c)
  if (beklenen.baslik) test(`başlık ~ ${beklenen.baslik}`, beklenen.baslik.test(c.baslik), c.baslik)
  if (beklenen.cozum) test(`çözüm ~ ${beklenen.cozum}`, !!c.cozum && beklenen.cozum.test(c.cozum), c.cozum)
  if (beklenen.agirlik) test(`ağırlık = ${beklenen.agirlik}`, c.agirlik === beklenen.agirlik, c.agirlik)
  test('teknik detay ham metni taşıyor', c.teknikDetay.includes(ham.slice(0, 40)))
  test('açıklama boş değil', c.aciklama.trim().length > 0)
  return c
}

console.log('═══ IFS / OData ═══')
dene('403 Insufficient privileges',
  "IFS 403 CustomerOrderHandling.svc/CustomerOrderSet?$select=OrderNo,CustomerName&$top=500: Insufficient privileges.",
  { takmaAd: 'customerOrder' },
  { baslik: /okuma yetkisi yok/i, cozum: /Egeria|yetki/i, agirlik: 'hata' })

dene('404 MI_METADATA_NOTFOUND (tekil/çoğul ikizi)',
  'IFS 404 ShopOrdersHandling.svc/$metadata: {"error":{"code":"MI_METADATA_NOTFOUND","message":"Metadata for projection ShopOrdersHandling not found."}}',
  {},
  { baslik: /projeksiyonu bulunamadı/i, cozum: /ShopOrderHandling/ })

dene('EXPRESSION_PROPERTY_NOT_IN_TYPE',
  'IFS 400 ShopOrderHandling.svc/ShopOrds?$select=OrderNo,CustomerNameX: {"error":{"code":"EXPRESSION_PROPERTY_NOT_IN_TYPE","message":"The property \'CustomerNameX\' is not found in type ShopOrd."}}',
  { entity: 'ShopOrd' },
  { baslik: /CustomerNameX.*ShopOrd/i, cozum: /katalog/i })

dene('ODP_UNSUPPORTED_URL (filtre sözdizimi)',
  'IFS 400 ShopOrderHandling.svc/ShopOrds?$filter=Contract%20eq%20ILER2: {"error":{"code":"ODP_UNSUPPORTED_URL","message":"Malformed Request: syntax error at position 12 in \'Contract eq ILER2\'."}}',
  {},
  { baslik: /sorgu biçimi hatalı/i, cozum: /Contract eq 'ILER2'/, agirlik: 'uyari' })

dene('401 token',
  'IFS 401 ShopOrderHandling.svc/ShopOrds: {"error":{"message":"Unauthorized"}}', {},
  { baslik: /oturumu geçersiz/i })
dene('token alınamadı',
  'IFS token alınamadı (HTTP 400)', {},
  { baslik: /oturumu alınamadı/i, cozum: /IFS_CLIENT_ID/ })
dene('ağ — fetch failed',
  'TypeError: fetch failed', {},
  { baslik: /ulaşılamadı/i, cozum: /VPN/i })
dene('sertifika',
  'Error: unable to verify the first certificate UNABLE_TO_VERIFY_LEAF_SIGNATURE', {},
  { baslik: /sertifika/i, cozum: /NODE_EXTRA_CA_CERTS/ })
dene('500 IFS',
  'IFS 500 ShopOrderHandling.svc/ShopOrds: {"error":{"message":"ORA-01722: invalid number"}}', {},
  { baslik: /IFS tarafında hata/i })

console.log('\n═══ Postgres ═══')
dene('42P01 relation',
  'Invalid `prisma.$queryRawUnsafe()` invocation:\nRaw query failed. Code: `42P01`. Message: `ERROR: relation "ipro_uretim_log" does not exist\n  Position: 15`',
  { takmaAd: 'ipro' },
  { baslik: /Tablo bulunamadı: ipro_uretim_log/ })
dene('42703 column',
  'Raw query failed. Code: `42703`. Message: `ERROR: column "qtycomplete" does not exist\n  Hint: Perhaps you meant to reference the column "p.qtyComplete".`',
  {},
  { baslik: /^Kolon bulunamadı: qtycomplete$/ })
dene('statement timeout',
  'Raw query failed. Code: `57014`. Message: `ERROR: canceling statement due to statement timeout`', {},
  { baslik: /30 saniyeyi aştı/, agirlik: 'uyari' })
dene('read-only',
  'Raw query failed. Code: `25006`. Message: `ERROR: cannot execute UPDATE in a read-only transaction`', {},
  { baslik: /Yalnız okuma/i })
dene('42601 syntax',
  'Raw query failed. Code: `42601`. Message: `ERROR: syntax error at or near "FROM"\n  Position: 24`', {},
  { baslik: /sözdizimi/i, agirlik: 'uyari' })
dene('SQL denetimi',
  'SQL: yalnız SELECT/WITH sorgusu kabul edilir', {},
  { baslik: /kabul edilmedi/i, agirlik: 'uyari' })

console.log('\n═══ Claude (AI) ═══')
dene('401', 'Yapay zekâ isteği başarısız: Anthropic 401: {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', {}, { baslik: /anahtarı geçersiz/i })
dene('429', 'Anthropic 429: {"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}', {}, { baslik: /kullanım limiti/i, agirlik: 'uyari' })
dene('529', 'Anthropic 529: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', {}, { baslik: /yanıt vermiyor/i })
dene('ağ', 'Yapay zekâ isteği başarısız: fetch failed', {}, { baslik: /AI servisine ulaşılamadı/i })
dene('anahtar yok', 'ANTHROPIC_API_KEY tanımlı değil', {}, { baslik: /yapılandırılmamış/i })

console.log('\n═══ Hub durum kodları ═══')
for (const [durum, ham] of [[403, 'Bu işlem için yetkiniz yok (rapor.tasarla)'], [405, ''], [409, "'is_emri_liste' adında bir veri seti zaten var"], [404, ''], [0, '']] as const) {
  const c = durumCevir(durum, ham)!
  bas(`HTTP ${durum}`, ham || `(boş gövde) HTTP ${durum}`, c)
  test('başlık var', !!c.baslik)
}
test("403 mesajında izin adı geçiyor", /rapor\.tasarla/.test(durumCevir(403, 'Bu işlem için yetkiniz yok (rapor.tasarla)')!.cozum ?? ''))
test('405 çözümü BT diyor', /BT/.test(durumCevir(405, '')!.cozum ?? ''))

console.log('\n═══ Bilinmeyen hata ═══')
const bilinmeyen = hataCevir('Something went terribly wrong in the pipeline. Extra line with details.')
bas('tanınmayan metin', 'Something went terribly wrong…', bilinmeyen)
test('başlık "Beklenmeyen hata"', bilinmeyen.baslik === 'Beklenmeyen hata')
test('açıklama ilk cümle', bilinmeyen.aciklama === 'Something went terribly wrong in the pipeline.')
test('teknik detay tamamı', bilinmeyen.teknikDetay.includes('Extra line with details.'))
const bos = hataCevir('')
test('boş metinde bile başlık/açıklama var', !!bos.baslik && !!bos.aciklama && !!bos.teknikDetay)

console.log(`\nSonuç: ${ok} başarılı, ${hata} hatalı`)
process.exitCode = hata ? 1 : 0
