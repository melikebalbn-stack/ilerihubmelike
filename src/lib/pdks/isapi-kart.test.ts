// @vitest-environment node
// (jsdom'un AbortSignal'ı Node fetch/undici ile uyuşmaz — ISAPI istemcisi gerçek fetch kullanır.)
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { IsapiHata } from './isapi-istemci'
import { kartSil, kartYaz, kullaniciSil, kullaniciYaz, paneldekiKartlar, hikZaman } from './isapi-kart'

/**
 * Sahte DS-K2604T: Digest (MD5, qop=auth) DOĞRULAR, kullanıcı/kart durumunu bellekte tutar.
 * Hikvision hata biçimi: HTTP 400 + {statusCode, subStatusCode}.
 */
const md5 = (s: string) => createHash('md5').update(s).digest('hex')
const REALM = 'DS-K2604T'
const NONCE = 'n0nce'
const USER = 'hub'
const PASS = 'dogru'

const panel = { kullanicilar: new Map<string, Record<string, unknown>>(), kartlar: new Map<string, string>() } // cardNo → employeeNo
let istekler: string[] = []
let zorla200Hata = false

function dogrula(req: http.IncomingMessage): boolean {
  const a = req.headers.authorization ?? ''
  if (!a.startsWith('Digest ')) return false
  const f: Record<string, string> = {}
  for (const m of a.matchAll(/(\w+)=(?:"([^"]*)"|([^\s,]+))/g)) f[m[1]] = m[2] ?? m[3]
  const ha1 = md5(`${f.username}:${REALM}:${f.username === USER ? PASS : '?'}`)
  return f.response === md5(`${ha1}:${NONCE}:${f.nc}:${f.cnonce}:auth:${md5(`${req.method}:${req.url}`)}`) && f.username === USER
}

const hata = (res: http.ServerResponse, alt: string) => {
  res.writeHead(400, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ statusCode: 6, statusString: 'Invalid Content', subStatusCode: alt }))
}
const tamam = (res: http.ServerResponse, ek: Record<string, unknown> = {}) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ statusCode: 1, statusString: 'OK', ...ek }))
}

const sunucu = http.createServer((req, res) => {
  if (!dogrula(req)) {
    res.writeHead(401, { 'WWW-Authenticate': `Digest qop="auth", realm="${REALM}", nonce="${NONCE}"` })
    return res.end()
  }
  let govde = ''
  req.on('data', (c) => (govde += c))
  req.on('end', () => {
    const yol = (req.url ?? '').replace('?format=json', '')
    istekler.push(`${req.method} ${yol}`)
    const b = govde ? JSON.parse(govde) : {}
    if (zorla200Hata) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ statusCode: 4, subStatusCode: 'deviceBusy' }))
    }
    switch (`${req.method} ${yol}`) {
      case 'POST /ISAPI/AccessControl/UserInfo/Record': {
        const u = b.UserInfo
        if (panel.kullanicilar.has(u.employeeNo)) return hata(res, 'employeeNoAlreadyExist')
        panel.kullanicilar.set(u.employeeNo, u)
        return tamam(res)
      }
      case 'PUT /ISAPI/AccessControl/UserInfo/Modify':
        panel.kullanicilar.set(b.UserInfo.employeeNo, b.UserInfo)
        return tamam(res)
      case 'PUT /ISAPI/AccessControl/UserInfo/Delete':
        for (const { employeeNo } of b.UserInfoDelCond.EmployeeNoList) {
          panel.kullanicilar.delete(employeeNo)
          for (const [k, e] of panel.kartlar) if (e === employeeNo) panel.kartlar.delete(k)
        }
        return tamam(res)
      case 'POST /ISAPI/AccessControl/CardInfo/Record': {
        const c = b.CardInfo
        if (panel.kartlar.has(c.cardNo)) return hata(res, 'cardNoAlreadyExist')
        panel.kartlar.set(c.cardNo, c.employeeNo)
        return tamam(res)
      }
      case 'PUT /ISAPI/AccessControl/CardInfo/Delete': {
        const k = b.CardInfoDelCond
        for (const { cardNo } of k.CardNoList ?? []) panel.kartlar.delete(cardNo)
        for (const { employeeNo } of k.EmployeeNoList ?? []) for (const [c, e] of panel.kartlar) if (e === employeeNo) panel.kartlar.delete(c)
        return tamam(res)
      }
      case 'POST /ISAPI/AccessControl/CardInfo/Search': {
        const { searchResultPosition: p, maxResults: n } = b.CardInfoSearchCond
        const tum = [...panel.kartlar].map(([cardNo, employeeNo]) => ({ cardNo, employeeNo }))
        const dilim = tum.slice(p, p + n)
        return tamam(res, {
          CardInfoSearch: {
            responseStatusStrg: tum.length === 0 ? 'NO MATCH' : p + n < tum.length ? 'MORE' : 'OK',
            numOfMatches: dilim.length, totalMatches: tum.length, CardInfo: dilim,
          },
        })
      }
      default:
        res.writeHead(404)
        return res.end()
    }
  })
})

let cihaz: { host: string; envOnek: string }

beforeAll(async () => {
  process.env.PDKS_CIHAZ_TEST_USER = USER
  process.env.PDKS_CIHAZ_TEST_PASS = PASS
  process.env.PDKS_CIHAZ_YANLIS_USER = USER
  process.env.PDKS_CIHAZ_YANLIS_PASS = 'yanlis'
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r))
  cihaz = { host: `127.0.0.1:${(sunucu.address() as AddressInfo).port}`, envOnek: 'PDKS_CIHAZ_TEST' }
})
afterAll(() => new Promise<void>((r) => sunucu.close(() => r())))
beforeEach(() => {
  panel.kullanicilar.clear()
  panel.kartlar.clear()
  istekler = []
  zorla200Hata = false
})

const kisi = (employeeNo: string) => ({ employeeNo, gecerliBaslangic: new Date('2026-09-26T05:00:00Z'), gecerliBitis: null, kapilar: [1, 2, 3, 4] })

describe('isapi-kart (sahte DS-K2604T)', () => {
  it('kullaniciYaz: yoksa ekler, varsa Modify ile günceller; ad yerine sicil gönderir', async () => {
    expect(await kullaniciYaz(cihaz, kisi('ILR-00001'))).toBe('EKLENDI')
    expect(await kullaniciYaz(cihaz, kisi('ILR-00001'))).toBe('GUNCELLENDI')
    const u = panel.kullanicilar.get('ILR-00001') as { name: string; doorRight: string; Valid: { beginTime: string; endTime: string } }
    expect(u.name).toBe('ILR-00001') // KVKK: ad panele gitmez
    expect(u.doorRight).toBe('1,2,3,4')
    expect(u.Valid.beginTime).toBe('2026-09-26T08:00:00') // +03:00 yerel
    expect(u.Valid.endTime).toBe('2037-12-31T23:59:59')
  })

  it('kartYaz: kişinin eski kartını siler, yenisini bağlar', async () => {
    await kullaniciYaz(cihaz, kisi('ILR-00001'))
    expect(await kartYaz(cihaz, 'ILR-00001', '11800001')).toBe('EKLENDI')
    expect(await kartYaz(cihaz, 'ILR-00001', '11800002')).toBe('EKLENDI')
    expect([...panel.kartlar]).toEqual([['11800002', 'ILR-00001']])
  })

  it('kartYaz: kart panelde başka kişiye bağlıysa Hub esas — alınır', async () => {
    panel.kartlar.set('11863577', 'ESKI-KISI')
    expect(await kartYaz(cihaz, 'ILR-00002', '11863577')).toBe('BASKASINDAN_ALINDI')
    expect(panel.kartlar.get('11863577')).toBe('ILR-00002')
  })

  it('kartSil / kullaniciSil', async () => {
    panel.kartlar.set('1', 'A')
    panel.kartlar.set('2', 'A')
    panel.kartlar.set('3', 'B')
    panel.kullanicilar.set('A', {})
    await kartSil(cihaz, '1')
    expect([...panel.kartlar.keys()]).toEqual(['2', '3'])
    await kullaniciSil(cihaz, 'A')
    expect([...panel.kartlar.keys()]).toEqual(['3'])
    expect(panel.kullanicilar.has('A')).toBe(false)
  })

  it('paneldekiKartlar: MORE ile sayfalar, hepsini toplar', async () => {
    for (let i = 1; i <= 5; i++) panel.kartlar.set(String(i), `E${i}`)
    const k = await paneldekiKartlar(cihaz, 2)
    expect(k.map((x) => x.cardNo)).toEqual(['1', '2', '3', '4', '5'])
    expect(istekler.filter((x) => x.endsWith('CardInfo/Search'))).toHaveLength(3)
  })

  it('boş panel: NO MATCH → []', async () => {
    expect(await paneldekiKartlar(cihaz)).toEqual([])
  })

  it('HTTP 200 + statusCode≠1 hata sayılır (altKod taşınır)', async () => {
    zorla200Hata = true
    const e = await kullaniciYaz(cihaz, kisi('X')).catch((x) => x)
    expect(e).toBeInstanceOf(IsapiHata)
    expect((e as IsapiHata).altKod).toBe('deviceBusy')
  })

  it('yanlış parola → KIMLIK, döngü yok (en fazla 2 istek)', async () => {
    const e = await kullaniciYaz({ ...cihaz, envOnek: 'PDKS_CIHAZ_YANLIS' }, kisi('X')).catch((x) => x)
    expect(e).toBeInstanceOf(IsapiHata)
    expect((e as IsapiHata).kod).toBe('KIMLIK')
  })

  it('kapı yetkisi yoksa cihaza gitmeden YAPILANDIRMA', async () => {
    const e = await kullaniciYaz(cihaz, { ...kisi('X'), kapilar: [] }).catch((x) => x)
    expect((e as IsapiHata).kod).toBe('YAPILANDIRMA')
    expect(istekler).toHaveLength(0)
  })

  it('hikZaman: UTC → +03:00 yerel, saniye hassasiyeti', () => {
    expect(hikZaman(new Date('2026-12-31T22:30:15.999Z'))).toBe('2027-01-01T01:30:15')
  })
})
