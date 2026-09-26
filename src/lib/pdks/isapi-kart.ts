import 'server-only'
import { randomUUID } from 'node:crypto'
import { IsapiHata, isapiIstek, type IsapiCihaz } from './isapi-istemci'

/**
 * Hikvision erişim kontrolü — kullanıcı/kart işlemleri (plan §3.2). YALNIZ cihaz tarafı;
 * DB ve kuyruk mantığı senkron.ts'te. Tüm çağrılar JSON (?format=json).
 *
 * Uç noktalar (DS-K2604T, ISAPI Access Control):
 *   POST /ISAPI/AccessControl/UserInfo/Record   kullanıcı ekle   (varsa → UserInfo/Modify, PUT)
 *   PUT  /ISAPI/AccessControl/UserInfo/Delete   kullanıcı sil (kartları da gider)
 *   POST /ISAPI/AccessControl/CardInfo/Record   kart ekle        (varsa → önce sil, tekrar ekle)
 *   PUT  /ISAPI/AccessControl/CardInfo/Delete   kart sil (CardNoList | EmployeeNoList)
 *   POST /ISAPI/AccessControl/CardInfo/Search   paneldeki kartlar (sayfalı, MORE/OK/NO MATCH)
 *
 * NOT: gövde alan adları ve subStatusCode değerleri Hikvision ISAPI dokümantasyonundandır;
 * gerçek firmware ile Faz 0'da doğrulanacak. Hub panelde TEK DOĞRULUK KAYNAĞIDIR: panelde
 * aynı kart başka kullanıcıya bağlıysa silinip Hub'daki kişiye yeniden bağlanır.
 *
 * KVKK: panele kişinin ADI GÖNDERİLMEZ — name = sicil (DS-K2604T'nin ekranı yok; olayları
 * Hub zaten sicil→kişi çözer). Veri minimizasyonu.
 */

const JSON_Q = '?format=json'

/** Hikvision bazı hataları HTTP 200 + gövdede statusCode≠1 ile döner — bunu da hata say. */
async function jsonIstek(cihaz: IsapiCihaz, yol: string, method: 'POST' | 'PUT', govde: unknown) {
  const y = await isapiIstek(cihaz, `${yol}${JSON_Q}`, { method, json: govde })
  let veri: Record<string, unknown> = {}
  if (y.metin.trim()) {
    try {
      veri = JSON.parse(y.metin) as Record<string, unknown>
    } catch {
      throw new IsapiHata('GECERSIZ_YANIT', `${yol}: JSON olmayan yanıt`)
    }
  }
  const sc = veri.statusCode
  if (sc !== undefined && Number(sc) !== 1) {
    const alt = typeof veri.subStatusCode === 'string' ? veri.subStatusCode : undefined
    throw new IsapiHata('HTTP', `${yol}: statusCode ${String(sc)} ${alt ?? ''}`.trim(), y.durum, alt)
  }
  return veri
}

const zatenVar = (e: unknown) => e instanceof IsapiHata && /alreadyexist/i.test(e.altKod ?? '')

/** Hikvision yerel saat biçimi (Europe/Istanbul, +03:00 sabit): "2026-09-26T00:00:00" */
export function hikZaman(d: Date): string {
  return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 19)
}
const GECERLILIK_SONU = '2037-12-31T23:59:59'

export interface PanelKullanici {
  employeeNo: string
  gecerliBaslangic: Date
  gecerliBitis: Date | null
  /** Yetkili kapı numaraları (ISAPI doorNo) */
  kapilar: number[]
}

function kullaniciGovdesi(k: PanelKullanici) {
  return {
    UserInfo: {
      employeeNo: k.employeeNo,
      name: k.employeeNo,
      userType: 'normal',
      Valid: {
        enable: true,
        beginTime: hikZaman(k.gecerliBaslangic),
        endTime: k.gecerliBitis ? hikZaman(k.gecerliBitis) : GECERLILIK_SONU,
        timeType: 'local',
      },
      doorRight: k.kapilar.join(','),
      RightPlan: k.kapilar.map((doorNo) => ({ doorNo, planTemplateNo: '1' })),
    },
  }
}

/** Kullanıcıyı ekler; panelde varsa günceller (upsert). */
export async function kullaniciYaz(cihaz: IsapiCihaz, k: PanelKullanici): Promise<'EKLENDI' | 'GUNCELLENDI'> {
  if (!k.kapilar.length) throw new IsapiHata('YAPILANDIRMA', 'Cihazda aktif kapı yok — kullanıcıya kapı yetkisi verilemez')
  try {
    await jsonIstek(cihaz, '/ISAPI/AccessControl/UserInfo/Record', 'POST', kullaniciGovdesi(k))
    return 'EKLENDI'
  } catch (e) {
    if (!zatenVar(e)) throw e
    await jsonIstek(cihaz, '/ISAPI/AccessControl/UserInfo/Modify', 'PUT', kullaniciGovdesi(k))
    return 'GUNCELLENDI'
  }
}

export async function kullaniciSil(cihaz: IsapiCihaz, employeeNo: string): Promise<void> {
  await jsonIstek(cihaz, '/ISAPI/AccessControl/UserInfo/Delete', 'PUT', {
    UserInfoDelCond: { EmployeeNoList: [{ employeeNo }] },
  })
}

export async function kartSil(cihaz: IsapiCihaz, cardNo: string): Promise<void> {
  await jsonIstek(cihaz, '/ISAPI/AccessControl/CardInfo/Delete', 'PUT', { CardInfoDelCond: { CardNoList: [{ cardNo }] } })
}

/** Kişinin paneldeki TÜM kartlarını siler (biçim değişikliği sonrası eski cardNo'lar dahil). */
export async function kisininKartlariniSil(cihaz: IsapiCihaz, employeeNo: string): Promise<void> {
  await jsonIstek(cihaz, '/ISAPI/AccessControl/CardInfo/Delete', 'PUT', {
    CardInfoDelCond: { EmployeeNoList: [{ employeeNo }] },
  })
}

/**
 * Kartı kişiye bağlar. Önce kişinin eski kartları silinir (kişi başı tek aktif kart; biçim
 * değişikliğinde eski cardNo kalmasın). Kart panelde BAŞKA kişiye bağlıysa o bağ silinip
 * yeniden eklenir (Hub esas) — yalnız bir kez.
 */
export async function kartYaz(cihaz: IsapiCihaz, employeeNo: string, cardNo: string): Promise<'EKLENDI' | 'BASKASINDAN_ALINDI'> {
  await kisininKartlariniSil(cihaz, employeeNo)
  const govde = { CardInfo: { employeeNo, cardNo, cardType: 'normalCard' } }
  try {
    await jsonIstek(cihaz, '/ISAPI/AccessControl/CardInfo/Record', 'POST', govde)
    return 'EKLENDI'
  } catch (e) {
    if (!zatenVar(e)) throw e
    await kartSil(cihaz, cardNo)
    await jsonIstek(cihaz, '/ISAPI/AccessControl/CardInfo/Record', 'POST', govde)
    return 'BASKASINDAN_ALINDI'
  }
}

export interface PanelKarti {
  employeeNo: string
  cardNo: string
}

/** Paneldeki tüm kartlar (sayfalı). Güvenlik sınırı: en fazla 200 sayfa. */
export async function paneldekiKartlar(cihaz: IsapiCihaz, sayfa = 30): Promise<PanelKarti[]> {
  const searchID = randomUUID()
  const sonuc: PanelKarti[] = []
  for (let i = 0; i < 200; i++) {
    const veri = await jsonIstek(cihaz, '/ISAPI/AccessControl/CardInfo/Search', 'POST', {
      CardInfoSearchCond: { searchID, searchResultPosition: sonuc.length, maxResults: sayfa },
    })
    const s = (veri.CardInfoSearch ?? {}) as { responseStatusStrg?: string; CardInfo?: { employeeNo?: string; cardNo?: string }[] }
    const liste = s.CardInfo ?? []
    for (const c of liste) if (c.cardNo) sonuc.push({ employeeNo: String(c.employeeNo ?? ''), cardNo: String(c.cardNo) })
    const durum = (s.responseStatusStrg ?? '').toUpperCase()
    if (durum !== 'MORE' || liste.length === 0) return sonuc
  }
  throw new IsapiHata('GECERSIZ_YANIT', 'CardInfo/Search 200 sayfayı aştı — döngü kesildi')
}
