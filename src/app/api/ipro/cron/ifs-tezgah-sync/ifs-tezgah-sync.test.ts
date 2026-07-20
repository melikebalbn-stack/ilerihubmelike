/**
 * IFS tezgah senkronu testleri (integration — gerçek dev DB, IFS enjekte).
 *
 * `tezgahSenkronu(resources)` IFS kaynaklarını PARAMETRE olarak alabildiği için
 * canlı IFS'e HİÇ gidilmez; sahte kaynak listesi verilir. Endpoint testinde ise
 * `ifsResourcesFetch` mock'lanır.
 *
 * Testin ürettiği TSY-* tezgahları afterAll'da silinir; mevcut seed verisine
 * dokunulmaz. PASİFLEME test edilmez (senkron pasifleme YAPMAZ — aşama 2 ayrı).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  tezgahSenkronu,
  startsWithKod,
  kodCikar,
  sifirsiz,
  makineDegil,
  adCikar,
  type IfsResource,
} from '@/lib/ipro/tezgah-sync'

// Test kod öneki — çakışma olmasın diye gerçek MAS kodlarından uzak.
const P = 'TZY' // harf-only: sifirsiz rakamlı önekte yanlış çalışır

const olusanKodlar: string[] = []
let mevcutTezgahId = ''

beforeAll(async () => {
  // (2) sıfır-dolgu ve (güncelleme) senaryoları için mevcut bir tezgah kur.
  const t = await prisma.iproTezgah.create({
    data: { kod: `${P}11`, ad: 'ESKİ AD', ifsResourceId: null, ifsWorkCenterNo: null, aktif: true },
    select: { id: true },
  })
  mevcutTezgahId = t.id
  olusanKodlar.push(`${P}11`)
})

afterAll(async () => {
  // Kod VE rid bazlı temizlik: kodsuz kayıtlar ResourceId'yle eklendiği için
  // kod eşleşmesi kaçırabilir (RID-MUK-* gibi).
  await prisma.iproTezgah.deleteMany({
    where: { OR: [{ kod: { in: olusanKodlar } }, { kod: { startsWith: 'RID-' } }, { ifsResourceId: { startsWith: 'RID-' } }] },
  })
  await prisma.$disconnect()
})

describe('saf yardımcılar', () => {
  it('startsWithKod sınır kuralı: PH08 ≠ PH081', () => {
    expect(startsWithKod('PH08 - PRES', 'PH08')).toBe(true)
    expect(startsWithKod('PH081 - PRES', 'PH08')).toBe(false)
    expect(startsWithKod('PH08-60 TON', 'PH08')).toBe(true) // sonrası tire → sınır
  })

  it('kodCikar açıklamadan kodu çeker', () => {
    expect(kodCikar('MM04 - MATKAP1')).toBe('MM04')
    expect(kodCikar('KR01-3 - KAYNAK')).toBe('KR01-3')
    expect(kodCikar('Lazer Kesim')).toBeNull()
  })

  it('sifirsiz sıfır dolgusunu atar', () => {
    expect(sifirsiz('PH011')).toBe('PH11')
    expect(sifirsiz('PE010')).toBe('PE10')
    expect(sifirsiz('PH11')).toBeNull() // zaten sade
    expect(sifirsiz('MM04')).toBeNull() // 2-haneli gerçek kod, dolgu değil
    expect(sifirsiz('PK09')).toBeNull() // aynı
  })

  it('makineDegil planlama WC + fason ayırır', () => {
    expect(makineDegil({ rid: 'WMM01', wc: 'WMM01', desc: 'x' })).toBe(true)
    expect(makineDegil({ rid: 'WYD', wc: 'WYD', desc: 'x' })).toBe(true)
    expect(makineDegil({ rid: 'FSN', wc: 'FSN', desc: 'x' })).toBe(true)
    expect(makineDegil({ rid: '90001', wc: '90001', desc: 'x' })).toBe(true)
    expect(makineDegil({ rid: '70201', wc: '702', desc: 'MM04 - MATKAP' })).toBe(false)
  })

  it('adCikar kod öneki varsa temizler, yoksa dokunmaz', () => {
    expect(adCikar('MM04 - MATKAP1')).toBe('MATKAP1')
    expect(adCikar('Lazer Kesim')).toBe('Lazer Kesim')
  })
})

describe('tezgahSenkronu', () => {
  it('planlama WC + fason taranmaz (makine sayısına girmez)', async () => {
    const r: IfsResource[] = [
      { rid: 'WMM01', wc: 'WMM01', desc: 'MONTAJ HATTI' },
      { rid: 'FSN', wc: 'FSN', desc: 'FASON' },
      { rid: '90001', wc: '90001', desc: 'ALTAŞ KALIP' },
    ]
    const s = await tezgahSenkronu(r)
    expect(s.taranan).toBe(0)
    expect(s.eklenen).toBe(0)
  })

  it('yeni makine EKLENİR — kod açıklamadan, IFS alanları dolu', async () => {
    const kod = `${P}77`
    olusanKodlar.push(kod)
    const s = await tezgahSenkronu([{ rid: '99977', wc: '999', desc: `${kod} - TEST MATKAP` }])
    expect(s.eklenen).toBe(1)

    const t = await prisma.iproTezgah.findUnique({ where: { kod }, select: { ad: true, ifsResourceId: true, ifsWorkCenterNo: true, aktif: true } })
    expect(t).toMatchObject({ ad: 'TEST MATKAP', ifsResourceId: '99977', ifsWorkCenterNo: '999', aktif: true })
  })

  it('kodsuz makine → ResourceId kod olarak', async () => {
    const kod = `${P}KODSUZ`
    olusanKodlar.push(kod)
    const s = await tezgahSenkronu([{ rid: kod, wc: '101', desc: 'Lazer Kesim' }])
    expect(s.eklenen).toBe(1)
    const t = await prisma.iproTezgah.findUnique({ where: { kod }, select: { ad: true, ifsResourceId: true } })
    expect(t).toMatchObject({ ad: 'Lazer Kesim', ifsResourceId: kod })
  })

  it('KODSUZ kaynak İKİNCİ koşuda ATLANIR — unique hata DEĞİL (ifsResourceId fallback)', async () => {
    // Prod 10101 bug'ı: kodsuz kaynak (desc'te kod yok) kod-önekle bulunamıyor,
    // her koşuda yeniden eklenmeye çalışılıp unique hata veriyordu.
    const kod = `${P}KODSUZ` // önceki testte eklendi
    const r = [{ rid: kod, wc: '101', desc: 'Lazer Kesim' }]
    const s = await tezgahSenkronu(r)
    expect(s.eklenen).toBe(0) // yeniden eklenmez
    expect(s.hatalilar).toHaveLength(0) // unique hata YOK
    expect(s.atlanan + s.guncellenen).toBe(1) // ResourceId ile bulundu, ele alındı

    // WC değişirse ikinci koşu güncellemeli (yine ekleme değil)
    const s2 = await tezgahSenkronu([{ rid: kod, wc: '999', desc: 'Lazer Kesim' }])
    expect(s2.eklenen).toBe(0)
    expect(s2.guncellenen).toBe(1)
    expect(s2.hatalilar).toHaveLength(0)
    const t = await prisma.iproTezgah.findUnique({ where: { kod }, select: { ifsWorkCenterNo: true } })
    expect(t?.ifsWorkCenterNo).toBe('999')
  })

  it('BACKFILL: eşleşen kaydın boş IFS alanları dolar, ad da güncellenir', async () => {
    const s = await tezgahSenkronu([{ rid: 'RID-TZY-A', wc: '208', desc: `${P}11 - YENİ AD` }])
    expect(s.guncellenen).toBe(1)
    const t = await prisma.iproTezgah.findUnique({ where: { id: mevcutTezgahId }, select: { ad: true, ifsResourceId: true, ifsWorkCenterNo: true } })
    expect(t).toMatchObject({ ad: 'YENİ AD', ifsResourceId: 'RID-TZY-A', ifsWorkCenterNo: '208' })
  })

  it('değişiklik yoksa ATLANIR (idempotent)', async () => {
    // Bir önceki testten sonra TZY11 artık RID-TZY-A/208/YENİ AD. Aynı kaynak → atla.
    const s = await tezgahSenkronu([{ rid: 'RID-TZY-A', wc: '208', desc: `${P}11 - YENİ AD` }])
    expect(s.atlanan).toBe(1)
    expect(s.guncellenen).toBe(0)
    expect(s.eklenen).toBe(0)
  })

  it('sıfır-dolgu şüphelisi mevcut kayda bağlanır, YENİ kayıt açılmaz', async () => {
    // TZY11 var; IFS "TZY011" olarak gelirse → TZY11'e bağlan, TZY011 açma.
    // Sıra bağımsızlığı için TZY11'in rid'ini bilinen bir değere resetle (önceki
    // testler değiştirmiş olabilir — bu test rid DEĞİŞİMİNİ ölçüyor).
    await prisma.iproTezgah.update({ where: { kod: `${P}11` }, data: { ifsResourceId: 'RESET-RID' } })
    const oncekiSayi = await prisma.iproTezgah.count({ where: { kod: { startsWith: P } } })
    const s = await tezgahSenkronu([{ rid: 'RID-TZY-B', wc: '308', desc: `${P}011 - PRES` }])
    expect(s.eklenen).toBe(0)
    expect(s.guncellenen).toBe(1) // rid RESET-RID → RID-TZY-B değişti → güncelleme
    const sonrakiSayi = await prisma.iproTezgah.count({ where: { kod: { startsWith: P } } })
    expect(sonrakiSayi).toBe(oncekiSayi) // yeni kod açılmadı
    const yok = await prisma.iproTezgah.findUnique({ where: { kod: `${P}011` } })
    expect(yok).toBeNull()
    const t = await prisma.iproTezgah.findUnique({ where: { kod: `${P}11` }, select: { ifsResourceId: true } })
    expect(t?.ifsResourceId).toBe('RID-TZY-B') // TZY11'e bağlandı
  })

  it('MÜKERRER rid (KR02 anomalisi): deterministik seçim, ikinci koşuda guncellenen=0', async () => {
    // Aynı rid, iki farklı WC/ad — IFS'te KR02 kaynak robotlarındaki gibi.
    const kod = `${P}88` // sayısal: kodCikar yakalasın (harf-only olursa null)
    olusanKodlar.push(kod)
    const cift = (wc: string, ad: string) => ({ rid: 'RID-MUK-1', wc, desc: `${kod} - ${ad}` })
    const kaynaklar = [cift('302', 'IKINCI KAPI'), cift('301', 'BIRINCI KAPI')] // sırası karışık

    // 1. koşu: kayıt yok → en küçük WC (301) deterministik seçilir → eklenir.
    const s1 = await tezgahSenkronu(kaynaklar)
    expect(s1.eklenen).toBe(1)
    expect(s1.mukerrerRidler).toHaveLength(1)
    expect(s1.mukerrerRidler[0]).toMatchObject({ rid: 'RID-MUK-1' })
    expect(s1.mukerrerRidler[0].wcler.sort()).toEqual(['301', '302'])
    const t1 = await prisma.iproTezgah.findUnique({ where: { kod }, select: { ifsWorkCenterNo: true, ad: true } })
    expect(t1).toMatchObject({ ifsWorkCenterNo: '301', ad: 'BIRINCI KAPI' }) // küçük WC seçildi

    // 2. koşu: mevcut değer (301) gruptakilerden biri → KORUNUR → guncellenen=0.
    const s2 = await tezgahSenkronu(kaynaklar)
    expect(s2.guncellenen).toBe(0) // SALINIM YOK
    expect(s2.eklenen).toBe(0)
    expect(s2.hatalilar).toHaveLength(0)
    expect(s2.mukerrerRidler).toHaveLength(1) // anomali her koşu raporlanır
    const t2 = await prisma.iproTezgah.findUnique({ where: { kod }, select: { ifsWorkCenterNo: true } })
    expect(t2?.ifsWorkCenterNo).toBe('301') // hâlâ 301, salınmadı
  })

  it('PASİFLEME YAPMAZ — IFS listesinde olmayan tezgaha dokunmaz', async () => {
    const oncekiAktif = await prisma.iproTezgah.count({ where: { aktif: true } })
    await tezgahSenkronu([{ rid: '99977', wc: '999', desc: `${P}77 - TEST MATKAP` }]) // yalnız 1 makine
    const sonrakiAktif = await prisma.iproTezgah.count({ where: { aktif: true } })
    expect(sonrakiAktif).toBe(oncekiAktif) // hiç pasifleşmedi
  })
})

describe('cron endpoint', () => {
  it('x-cron-secret yanlış → 401', async () => {
    vi.resetModules()
    const { POST } = await import('@/app/api/ipro/cron/ifs-tezgah-sync/route')
    const req = new Request('http://x', { method: 'POST', headers: { 'x-cron-secret': 'yanlis' } })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('doğru secret → senkron koşar, {taranan,eklenen,...} döner (IFS mock)', async () => {
    vi.resetModules()
    // tezgahSenkronu'nun TAMAMI mock — route yalnız onu çağırıyor, IFS'e hiç
    // gidilmez. (ifsResourcesFetch'i mock'lamak yetmez: tezgahSenkronu onu
    // modül-İÇİ referansla çağırıyor, mock devreye girmez.)
    vi.doMock('@/lib/ipro/tezgah-sync', () => ({
      tezgahSenkronu: vi.fn(async () => ({ taranan: 0, eklenen: 0, guncellenen: 0, atlanan: 0, hatalilar: [], mukerrerRidler: [] })),
    }))
    const { POST } = await import('@/app/api/ipro/cron/ifs-tezgah-sync/route')
    const secret = process.env.CRON_SECRET
    const req = new Request('http://x', { method: 'POST', headers: { 'x-cron-secret': secret ?? '' } })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d).toHaveProperty('taranan')
    expect(d).toHaveProperty('eklenen')
    expect(d).toHaveProperty('guncellenen')
    expect(d).toHaveProperty('atlanan')
    expect(Array.isArray(d.hatalilar)).toBe(true)
    expect(Array.isArray(d.mukerrerRidler)).toBe(true)
    vi.doUnmock('@/lib/ipro/tezgah-sync')
  })
})
