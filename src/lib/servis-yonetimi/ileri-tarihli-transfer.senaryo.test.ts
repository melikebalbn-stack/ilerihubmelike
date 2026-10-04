import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// C7 — ileri tarihli transfer UÇTAN UCA senaryo (fake saat + bellek içi fake DB).
// Gerçek modüller çalışır: gecisPlanla, veri-kalite okuyucuları, bağımlılık korumaları, durum rozeti, ortak filtreler.
// Fake DB, Prisma `where` ağacını GERÇEKTEN değerlendirir (ortak filtre yanlışsa test düşer).

type Atama = {
  id: string
  personnelId: string
  guzergahId: string
  aktif: boolean
  baslangicTarihi: Date
  bitisTarihi: Date | null
}

const db = vi.hoisted(() => ({ atamalar: [] as Atama[] }))

type Where = Record<string, unknown>
const tarihKarsilastir = (v: Date | null, f: Where): boolean => {
  if (v === null) return false
  if (f.gte && !(v >= (f.gte as Date))) return false
  if (f.lte && !(v <= (f.lte as Date))) return false
  if (f.lt && !(v < (f.lt as Date))) return false
  return true
}
function eslesir(a: Atama, where: Where | undefined): boolean {
  if (!where) return true
  for (const [anahtar, deger] of Object.entries(where)) {
    if (anahtar === 'OR') {
      if (!(deger as Where[]).some((w) => eslesir(a, w))) return false
    } else if (anahtar === 'aktif' || anahtar === 'guzergahId') {
      if ((a as never)[anahtar] !== deger) return false
    } else if (anahtar === 'personnelId') {
      const d = deger as { in?: string[] } | string
      if (typeof d === 'string' ? a.personnelId !== d : !d.in!.includes(a.personnelId)) return false
    } else if (anahtar === 'baslangicTarihi') {
      if (!tarihKarsilastir(a.baslangicTarihi, deger as Where)) return false
    } else if (anahtar === 'bitisTarihi') {
      if (deger === null) {
        if (a.bitisTarihi !== null) return false
      } else if (!tarihKarsilastir(a.bitisTarihi, deger as Where)) return false
    } else {
      throw new Error(`Fake DB desteklemiyor: ${anahtar}`)
    }
  }
  return true
}
const PERSONEL = (id: string) => ({ id, sicilNo: `S-${id}`, adSoyad: `Şükrü Çağlayan ${id}`, bolum: 'Üretim' })
const zenginlestir = (a: Atama) => ({ ...a, personnel: PERSONEL(a.personnelId), guzergah: { kod: a.guzergahId, ad: `Güzergâh ${a.guzergahId}` } })

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servisPersonelAtama: {
      findMany: async ({ where }: { where?: Where }) => db.atamalar.filter((a) => eslesir(a, where)).map(zenginlestir),
      count: async ({ where }: { where?: Where }) => db.atamalar.filter((a) => eslesir(a, where)).length,
      groupBy: async ({ where }: { where?: Where }) => {
        const sayac = new Map<string, number>()
        for (const a of db.atamalar.filter((x) => eslesir(x, where))) sayac.set(a.personnelId, (sayac.get(a.personnelId) ?? 0) + 1)
        return [...sayac].filter(([, n]) => n > 1).map(([personnelId, n]) => ({ personnelId, _count: { _all: n } }))
      },
    },
    personnel: {
      findMany: async ({ where }: { where: Where }) => {
        const idler = new Set(db.atamalar.map((a) => a.personnelId))
        if (where.id) return (where.id as { in: string[] }).in.map(PERSONEL)
        const none = (where.servisAtamalari as { none?: Where } | undefined)?.none
        if (none) return [...idler].filter((id) => !db.atamalar.some((a) => a.personnelId === id && eslesir(a, none))).map(PERSONEL)
        return []
      },
    },
  },
}))

import { ATAMA_DURUM_ETIKETLERI, atamaDurumu, engelleyiciAtamaFiltresi, gecerliAtamaFiltresi, gunTarihi, tarihAraligiFiltresi } from './gecerli-atama'
import { gecisPlanla } from './atama-gecis'
import { guzergahBagimliliklari } from './bagimlilik'
import { aktifPersonelServisYok, cakisanAtamalar, mukerrerAktifServis, suresiBitmisGeciciAtama } from './veri-kalite'

const T0 = '2026-10-03T09:00:00.000Z' // TR 2026-10-03
const GECIS = '2026-10-10'
const saat = (iso: string) => vi.setSystemTime(new Date(iso))

function ileriTarihliTransferKaydet(personnelId = 'p1') {
  const eski: Atama = { id: `eski-${personnelId}`, personnelId, guzergahId: 'gEski', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: null }
  db.atamalar.push(eski)
  const plan = gecisPlanla(eski.baslangicTarihi, GECIS, 'Geçiş tarihi')
  eski.bitisTarihi = plan.eskiBitis
  eski.aktif = plan.eskiAktif
  db.atamalar.push({ id: `yeni-${personnelId}`, personnelId, guzergahId: 'gYeni', aktif: true, baslangicTarihi: plan.yeniBaslangic, bitisTarihi: null })
  return plan
}

const bagimlilikSayisi = async (guzergahId: string) => {
  const sayac = {
    servisPersonelAtama: { count: async ({ where }: { where: Where }) => db.atamalar.filter((a) => eslesir(a, where)).length },
    servisGuzergahAracVarsayilan: { count: async () => 0, findMany: async () => [] },
    servisGuzergahSoforVarsayilan: { count: async () => 0 },
  }
  const g = await guzergahBagimliliklari(sayac as never, guzergahId)
  return g.find((x) => x.tur === 'PERSONEL_ATAMA')?.sayi ?? 0
}

beforeEach(() => {
  db.atamalar.length = 0
  vi.useFakeTimers({ toFake: ['Date'] })
  saat(T0)
})
afterEach(() => vi.useRealTimers())

describe('C7 uçtan uca — ileri tarihli transfer (geçiş 2026-10-10, bugün 2026-10-03)', () => {
  it('plan: eski atama aktif kalır, bitişi geçiş−1; yeni atama geçiş gününde başlar', () => {
    const plan = ileriTarihliTransferKaydet()
    expect(plan.eskiAktif).toBe(true)
    expect(db.atamalar[0].bitisTarihi?.toISOString().slice(0, 10)).toBe('2026-10-09')
    expect(db.atamalar[1].baslangicTarihi.toISOString().slice(0, 10)).toBe(GECIS)
  })

  it('(a) 🔴 kaydedilir kaydedilmez VK alarmı YOK: Mükerrer, Çakışan, "Aktif personel/servis yok", "Süresi bitmiş"', async () => {
    ileriTarihliTransferKaydet()
    expect((await mukerrerAktifServis()).adet).toBe(0)
    expect((await cakisanAtamalar()).adet).toBe(0)
    expect((await aktifPersonelServisYok()).adet).toBe(0) // eski atama bugün geçerli
    expect((await suresiBitmisGeciciAtama()).adet).toBe(0)
  })

  it('(a) kontrol: gerçek mükerrer (bugün iki geçerli atama) hâlâ yakalanır', async () => {
    db.atamalar.push(
      { id: 'x1', personnelId: 'p9', guzergahId: 'gA', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: null },
      { id: 'x2', personnelId: 'p9', guzergahId: 'gB', aktif: true, baslangicTarihi: gunTarihi('2026-02-01'), bitisTarihi: null },
    )
    const m = await mukerrerAktifServis()
    expect(m.adet).toBe(1)
    expect(m.kayitlar[0]).toMatchObject({ personnelId: 'p9', aktifAtamaSayisi: 2, adSoyad: 'Şükrü Çağlayan p9' })
  })

  it('(b) güzergâh pasifleştirme engeli şişmez: eski güzergâh 1 (hâlâ geçerli), yeni güzergâh 1 (başlamamış da engel); geçişten sonra eski 0', async () => {
    ileriTarihliTransferKaydet()
    expect(await bagimlilikSayisi('gEski')).toBe(1)
    expect(await bagimlilikSayisi('gYeni')).toBe(1)
    saat('2026-10-10T09:00:00.000Z')
    expect(await bagimlilikSayisi('gEski')).toBe(0) // süresi geçmiş, aktif=true kalmış → engel değil
    expect(await bagimlilikSayisi('gYeni')).toBe(1)
  })

  it('(c) geçiş günü: eski atama geçerlilikten düşer, yeni görünür; VK alarm üretmez (tamamlanmış planlı geçiş)', async () => {
    ileriTarihliTransferKaydet()
    saat('2026-10-10T09:00:00.000Z')
    const gun = gunTarihi(GECIS)
    const gecerli = db.atamalar.filter((a) => eslesir(a, gecerliAtamaFiltresi(gun))).map((a) => a.id)
    expect(gecerli).toEqual(['yeni-p1'])
    expect((await mukerrerAktifServis()).adet).toBe(0)
    expect((await cakisanAtamalar()).adet).toBe(0)
    expect((await aktifPersonelServisYok()).adet).toBe(0) // yeni atama geçerli
    expect((await suresiBitmisGeciciAtama()).adet).toBe(0) // halefi var → hata sayılmaz
  })

  it('(c) kontrol: halefi OLMAYAN süresi bitmiş aktif atama hata olarak kalır', async () => {
    db.atamalar.push({ id: 'y1', personnelId: 'p7', guzergahId: 'gA', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: gunTarihi('2026-09-30') })
    const s = await suresiBitmisGeciciAtama()
    expect(s.adet).toBe(1)
    expect((await aktifPersonelServisYok()).adet).toBe(1)
  })

  it('(e) durum rozeti: kayıt günü eski=Aktif, yeni=Başlamadı; geçiş günü eski=Süresi doldu, yeni=Aktif', () => {
    ileriTarihliTransferKaydet()
    const [eski, yeni] = db.atamalar
    expect(ATAMA_DURUM_ETIKETLERI[atamaDurumu(eski)]).toBe('Aktif')
    expect(ATAMA_DURUM_ETIKETLERI[atamaDurumu(yeni)]).toBe('Başlamadı')
    saat('2026-10-10T09:00:00.000Z')
    expect(ATAMA_DURUM_ETIKETLERI[atamaDurumu(eski)]).toBe('Süresi doldu')
    expect(ATAMA_DURUM_ETIKETLERI[atamaDurumu(yeni)]).toBe('Aktif')
    expect(atamaDurumu({ ...eski, aktif: false })).toBe('PASIF')
  })

  it('(f) 🔴 TR 00:00–03:00 aralığı: UTC 20:59 → TR 10-03 (bitişi 10-03 olan atama hâlâ geçerli); UTC 21:00 → TR 10-04 (süresi bitmiş sayılır)', async () => {
    db.atamalar.push({ id: 'z1', personnelId: 'p5', guzergahId: 'gA', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: gunTarihi('2026-10-03') })
    saat('2026-10-03T20:59:00.000Z')
    expect((await suresiBitmisGeciciAtama()).adet).toBe(0)
    expect(atamaDurumu(db.atamalar[0])).toBe('AKTIF')
    expect(await bagimlilikSayisi('gA')).toBe(1)
    saat('2026-10-03T21:00:00.000Z')
    expect((await suresiBitmisGeciciAtama()).adet).toBe(1)
    expect(atamaDurumu(db.atamalar[0])).toBe('SURESI_DOLDU')
    expect(await bagimlilikSayisi('gA')).toBe(0)
  })

  it('(g) geçiş gününde konservatif çift görünme (KABUL): bugün-başlı transferde o günün tarih-only görünümü hem eski hem yeni atamayı içerir; bugünkü görünümde yalnız yeni', () => {
    // bugün-geçişli transfer: eski hemen pasif, bitiş = geçiş günü (atama-gecis.ts)
    const gun = gunTarihi('2026-10-03')
    const eski: Atama = { id: 'e', personnelId: 'p2', guzergahId: 'gEski', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: null }
    const plan = gecisPlanla(eski.baslangicTarihi, '2026-10-03', 'Geçiş tarihi')
    eski.aktif = plan.eskiAktif
    eski.bitisTarihi = plan.eskiBitis
    const yeni: Atama = { id: 'y', personnelId: 'p2', guzergahId: 'gYeni', aktif: true, baslangicTarihi: plan.yeniBaslangic, bitisTarihi: null }
    db.atamalar.push(eski, yeni)
    expect(plan.eskiAktif).toBe(false)

    const tarihOnly = db.atamalar.filter((a) => eslesir(a, tarihAraligiFiltresi(gun))).map((a) => a.id).sort()
    expect(tarihOnly).toEqual(['e', 'y']) // geçmiş gün görünümü (C7-9): yalnız tarih → çift görünme kabul
    const bugunku = db.atamalar.filter((a) => eslesir(a, gecerliAtamaFiltresi(gun))).map((a) => a.id)
    expect(bugunku).toEqual(['y']) // bugün/gelecek görünümü (aktif:true) → çift görünme yok
  })

  it('engelleyici filtre başlamamış atamayı engel sayar, süresi geçmişi saymaz (ortak kaynak)', () => {
    const gun = gunTarihi('2026-10-03')
    const rows: Atama[] = [
      { id: 'b', personnelId: 'p', guzergahId: 'g', aktif: true, baslangicTarihi: gunTarihi('2026-11-01'), bitisTarihi: null },
      { id: 's', personnelId: 'p', guzergahId: 'g', aktif: true, baslangicTarihi: gunTarihi('2026-01-01'), bitisTarihi: gunTarihi('2026-09-01') },
    ]
    expect(rows.filter((a) => eslesir(a, engelleyiciAtamaFiltresi(gun))).map((a) => a.id)).toEqual(['b'])
  })
})
