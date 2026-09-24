/**
 * Rapor modülü istemci fetch yardımcısı testi (sahte fetch — sunucu gerekmez).
 *   npx tsx scripts/rapor-api-istemci-test.ts
 * Asıl senaryo: uç eksikken gelen BOŞ gövdeli 405 ve HTML hata sayfası, ekranda
 * "Failed to execute 'json' on 'Response'" yerine anlaşılır Türkçe mesaja dönüşmeli.
 */
import { ApiHatasi, apiGet, apiGonder, apiYanit, hataListesi, hataMetni } from '../src/app/(dashboard)/raporlar/_components/api'

let ok = 0, hata = 0
const test = (ad: string, kosul: boolean, detay?: unknown) => { kosul ? ok++ : hata++; console.log(`${kosul ? '✓' : '✗'} ${ad}${kosul ? '' : `  → ${JSON.stringify(detay)}`}`) }

const sahte = (govde: string, init: { status?: number; ok?: boolean } = {}) => {
  const status = init.status ?? 200
  globalThis.fetch = (async () => new Response(govde, { status, headers: { 'content-type': 'application/json' } })) as typeof fetch
}
const yakala = async (f: () => Promise<unknown>) => { try { await f(); return null } catch (e) { return e } }

async function main() {
  sahte(JSON.stringify({ veriSetleri: [1, 2] }))
  test('200 JSON → gövde döner', ((await apiGet<{ veriSetleri: number[] }>('/x')).veriSetleri.length) === 2)

  // Next boş gövdeli 405 döndürür → eskiden r.json() patlıyordu.
  sahte('', { status: 405 })
  const e405 = await yakala(() => apiGonder('/x', 'PUT', {}))
  test('boş 405 → "sunucuda tanımlı değil"', e405 instanceof ApiHatasi && e405.durum === 405 && /tanımlı değil/.test(e405.message), hataMetni(e405))
  test('405 mesajı JSON ayrıştırma hatası DEĞİL', !/Failed to execute/.test(hataMetni(e405)))

  sahte('<!DOCTYPE html><html><body><h1>500 Internal Server Error</h1></body></html>', { status: 500 })
  const eHtml = await yakala(() => apiGet('/x'))
  test('HTML gövdeli 500 → mesaj + ham özet', /Sunucu hatası/.test(hataMetni(eHtml)) && /Internal Server Error/.test(hataMetni(eHtml)), hataMetni(eHtml))

  sahte(JSON.stringify({ error: 'Tanım geçersiz', hatalar: ['a', 'b'] }), { status: 400 })
  const e400 = await yakala(() => apiGonder('/x', 'POST', {}))
  test('uç mesajı korunur + hatalar[] taşınır', hataMetni(e400) === 'Tanım geçersiz' && hataListesi(e400).join(',') === 'a,b')

  sahte('', { status: 403 })
  test('403 → yetki mesajı', /yetkiniz yok/.test(hataMetni(await yakala(() => apiGet('/x')))))
  sahte('', { status: 401 })
  test('401 → oturum mesajı', /Oturum/.test(hataMetni(await yakala(() => apiGet('/x')))))

  sahte('bu json değil', { status: 200 })
  const eBozuk = await yakala(() => apiGet('/x'))
  test('200 ama bozuk JSON → ham metin gösterilir', /beklenmeyen yanıt/i.test(hataMetni(eBozuk)) && /bu json değil/.test(hataMetni(eBozuk)), hataMetni(eBozuk))

  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
  test('ağ hatası → bağlanılamadı (durum 0)', /bağlanılamadı/.test(hataMetni(await yakala(() => apiGet('/x')))))

  // apiYanit: gövdeyi okumaz (blob yolu), hatada mesaj üretir
  sahte('', { status: 200 })
  test('apiYanit 200 → Response döner', (await apiYanit('/x')).ok)
  sahte('', { status: 405 })
  test('apiYanit 405 → ApiHatasi', (await yakala(() => apiYanit('/x'))) instanceof ApiHatasi)

  console.log(`\nSonuç: ${ok} başarılı, ${hata} hatalı`)
  process.exitCode = hata ? 1 : 0
}
main()
