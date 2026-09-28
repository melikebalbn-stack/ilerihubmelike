// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

/**
 * İzin Faz 5 — Ekip Takvimi erişimi + hücreleri, aylık puantaj Excel'inin yetkiye göre izin sütunları.
 */
type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ t: {} as Record<string, Row[]>, ekip: {} as Record<string, string[]> }))

vi.mock('@/lib/prisma', () => {
  const d = (x: unknown) => (x instanceof Date ? x.getTime() : x)
  const uyar = (r: Row, w?: Row): boolean =>
    !w || Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((x) => uyar(r, x))
      const x = r[k]
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Row
        if ('in' in o) return (o.in as unknown[]).some((y) => d(y) === d(x))
        if ('lte' in o || 'gte' in o) return (!('lte' in o) || (d(x) as number) <= (d(o.lte) as number)) && (!('gte' in o) || (d(x) as number) >= (d(o.gte) as number))
        return false
      }
      return d(x ?? null) === d(v ?? null)
    })
  const m = (ad: string) => ({
    findMany: async ({ where }: { where?: Row } = {}) => (db.t[ad] ?? []).filter((r) => uyar(r, where)),
    findUnique: async ({ where }: { where: Row }) => (db.t[ad] ?? []).find((r) => uyar(r, where)) ?? null,
    count: async ({ where }: { where?: Row } = {}) => (db.t[ad] ?? []).filter((r) => uyar(r, where)).length,
  })
  return { prisma: Object.fromEntries(['personnel', 'departmentDefinition', 'izinTalep', 'izinTalepGun', 'iproTatil'].map((a) => [a, m(a)])) }
})
vi.mock('@/lib/onay/yonetici-cozumu', () => ({ getManagedPersonnelIds: async (pid: string) => db.ekip[pid] ?? [] }))
vi.mock('@/lib/pdks/puantaj-servis', async (orj) => ({ ...(await orj<object>()), bugunStr: () => '2026-10-28' }))
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: async () => ({ ok: true }) }))

import { ekipTakvimi, takvimTablosu } from './takvim-servis'
import { turSiziyorMu } from './gorunum'
import { IzinYetkiHatasi } from './gun-sayimi'
import { izinHata } from './yonetim'
import { izinSutunu, puantajExcel } from '@/lib/pdks/puantaj-servis'

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const ctx = (userId: string, personnelId: string | null, ivMi = false) => ({ userId, personnelId, ivMi, bakiyeAdmin: false })
const talep = (id: string, pid: string, bas: string, bit: string, durum = 'ONAYLANDI', o: Row = {}) =>
  ({ id, personnelId: pid, durum, baslangic: d(bas), bitis: d(bit), baslangicYarim: null, bitisYarim: null, turId: 't-EVLILIK', aciklama: 'gizli not', ...o })

beforeEach(() => {
  db.ekip = { 'p-m': ['p-a', 'p-b'] }
  db.t = {
    departmentDefinition: [{ id: 'dep1', name: 'Kaynakhane', isActive: true }, { id: 'dep2', name: 'Montaj', isActive: true }],
    personnel: [
      { id: 'p-m', adSoyad: 'Yönetici', aktif: true, departmentId: 'dep1' },
      { id: 'p-a', adSoyad: 'Ali', aktif: true, departmentId: 'dep1' },
      { id: 'p-b', adSoyad: 'Banu', aktif: true, departmentId: 'dep1' },
      { id: 'p-x', adSoyad: 'Başka Ekip', aktif: true, departmentId: 'dep2' },
    ],
    iproTatil: [{ tarih: d('2026-10-28'), tip: 'YARIM', aciklama: 'Cumhuriyet Bayramı arefesi' }, { tarih: d('2026-10-29'), tip: 'TATIL', aciklama: 'Cumhuriyet Bayramı' }],
    // Ali: onaylı 26 Eyl – 2 Eki (ay sınırını aşar), donmuş günleri; Banu: bekleyen 26–30 Eki; Başka: onaylı
    izinTalep: [
      talep('t1', 'p-a', '2026-09-28', '2026-10-02'),
      talep('t2', 'p-b', '2026-10-26', '2026-10-30', 'BEKLIYOR_YONETICI'),
      talep('t3', 'p-x', '2026-10-05', '2026-10-06'),
    ],
    izinTalepGun: [
      ...['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'].map((t) => ({ talepId: 't1', personnelId: 'p-a', tarih: d(t), pay: 1, yarim: null })),
      { talepId: 't1', personnelId: 'p-a', tarih: d('2026-10-02'), pay: 0.5, yarim: 'SABAH' },
      ...['2026-10-05', '2026-10-06'].map((t) => ({ talepId: 't3', personnelId: 'p-x', tarih: d(t), pay: 1, yarim: null })),
    ],
  }
})

describe('Ekip Takvimi — erişim', () => {
  it('yönetici YALNIZ kendi ekibini görür; departmentId parametresi yok sayılır', async () => {
    const r = await ekipTakvimi(ctx('u-m', 'p-m'), { ay: '2026-10', departmentId: 'dep2' })
    expect(r.satirlar.map((s) => s.ad)).toEqual(['Ali', 'Banu'])
    expect(r.departmanlar).toBeNull()
    expect(r.kapsam).toBe('EKIP')
  })
  it('çalışan (ekibi yok) 403', async () => {
    const hata = await ekipTakvimi(ctx('u-a', 'p-a'), { ay: '2026-10' }).catch((e) => e)
    expect(hata).toBeInstanceOf(IzinYetkiHatasi)
    expect(izinHata(hata).status).toBe(403)
    await expect(ekipTakvimi(ctx('u-z', null), { ay: '2026-10' })).rejects.toBeInstanceOf(IzinYetkiHatasi)
  })
  it('İV tüm departmanlar: seçiciyle başka departman; varsayılan kendi departmanı', async () => {
    expect((await ekipTakvimi(ctx('u-iv', 'p-m', true), { ay: '2026-10', departmentId: 'dep2' })).satirlar.map((s) => s.ad)).toEqual(['Başka Ekip'])
    const v = await ekipTakvimi(ctx('u-iv', 'p-m', true), { ay: '2026-10' })
    expect(v.departmentId).toBe('dep1')
    expect(v.departmanlar?.map((x) => x.name)).toEqual(['Kaynakhane', 'Montaj'])
  })
})

describe('Ekip Takvimi — hücreler ve sızıntı', () => {
  it('ay sınırını aşan izin kırpılır; yarım gün açık mavi; bekleyen turuncu; tatil/arefe/hafta sonu gri', async () => {
    const r = await ekipTakvimi(ctx('u-m', 'p-m'), { ay: '2026-10' })
    const ali = r.satirlar.find((s) => s.ad === 'Ali')!
    const banu = r.satirlar.find((s) => s.ad === 'Banu')!
    const h = (s: typeof ali, gun: number) => s.hucreler[gun - 1]
    expect(r.gunler).toHaveLength(31)
    expect(h(ali, 1)).toEqual({ h: 'IZINLI', title: 'İzinli' }) // Eylül'de başlayan izin Ekim'e yalnız 1-2 olarak girer
    expect(h(ali, 2)).toEqual({ h: 'YARIM', title: 'Yarım gün izinli' })
    expect(h(ali, 3)).toEqual({ h: 'HAFTA_SONU', title: 'Hafta sonu' })
    expect(h(ali, 5)).toEqual({ h: 'BOS', title: '' })
    expect(h(banu, 26)).toEqual({ h: 'BEKLIYOR', title: 'Onay bekliyor' })
    expect(h(banu, 28)).toEqual({ h: 'BEKLIYOR', title: 'Onay bekliyor' }) // arefe: bekleyen izin yarım gün sayılır ama hücre bekliyor
    expect(h(banu, 29)).toEqual({ h: 'TATIL', title: 'Cumhuriyet Bayramı' })
    expect(h(ali, 28)).toEqual({ h: 'YARIM_TATIL', title: 'Cumhuriyet Bayramı arefesi' })
    expect(r.ozet).toEqual({ bugunIzinli: 0, ekip: 2, enYogun: { tarih: '2026-10-01', kisi: 1 }, bekleyenTalep: 1 })
  })
  it('yanıtta tür, açıklama, bakiye YOK', async () => {
    const r = await ekipTakvimi(ctx('u-m', 'p-m'), { ay: '2026-10' })
    expect(turSiziyorMu(r)).toBeNull()
    expect(JSON.stringify(r)).not.toMatch(/EVLILIK|gizli not|t-EVLILIK|bakiye/i)
    expect(turSiziyorMu(await ekipTakvimi(ctx('u-iv', 'p-m', true), { ay: '2026-10' }))).toBeNull() // İV'de de takvim türsüz
  })
  it('saf tablo: ay dışı gün atılır; en yoğun gün eşitlikte ilk tarih', () => {
    const t = takvimTablosu({
      bas: '2026-11-01', bit: '2026-11-30', bugun: '2026-11-02', kisiler: [{ id: 'a', ad: 'A' }, { id: 'b', ad: 'B' }], tatiller: new Map(),
      izinGunleri: [
        { personnelId: 'a', tarih: '2026-10-31', yarim: false, durum: 'IZINLI', etiket: 'İzinli' },
        { personnelId: 'a', tarih: '2026-11-02', yarim: false, durum: 'IZINLI', etiket: 'İzinli' },
        { personnelId: 'b', tarih: '2026-11-03', yarim: true, durum: 'IZINLI', etiket: 'İzinli' },
      ],
    })
    expect(t.satirlar[0].hucreler.filter((c) => c.h === 'IZINLI')).toHaveLength(1)
    expect(t.ozet).toEqual({ bugunIzinli: 1, ekip: 2, enYogun: { tarih: '2026-11-02', kisi: 1 } })
  })
})

describe('Aylık puantaj Excel — izin sütunları yetkiye göre', () => {
  const satir = (pid: string, gun: string, durum: string, izinPay: number | null, tur: { kod: string; ucretli: boolean } | null) => ({
    personnelId: pid, gun: d(gun), durum, izinPay, izinTalep: tur ? { tur } : null, ilkGiris: null, sonCikis: null, girisKaynak: null, cikisKaynak: null,
    gecDakika: 0, erkenCikisDakika: 0, calismaDakika: null, fiiliDakika: null, dusulenMolaDakika: null, onayliMesaiDakika: null, fazlaDakika: null,
    uyarilar: [], kilitli: false, vardiya: null, beklenenBaslangic: null, beklenenBitis: null,
    personnel: { sicilNo: 'S1', adSoyad: 'Ali', bolum: 'K', departmentId: 'dep1', department: null },
  })
  const fakeDb = {
    pdksPuantajGun: {
      findMany: async () => [
        satir('p1', '2026-10-01', 'IZINLI', 1, { kod: 'YILLIK', ucretli: true }),
        satir('p1', '2026-10-02', 'TAM', 0.5, { kod: 'YILLIK', ucretli: true }), // yarım gün izin
        satir('p1', '2026-10-05', 'IZINLI', 1, { kod: 'EVLILIK', ucretli: true }),
        satir('p1', '2026-10-06', 'IZINLI', 1, { kod: 'UCRETSIZ', ucretli: false }),
      ],
    },
  }
  const ozet = async (izinDetay: boolean) => {
    const { buffer } = await puantajExcel(fakeDb as never, '2026-10-01', '2026-10-31', null, { izinDetay })
    const ws = XLSX.read(buffer, { type: 'buffer' }).Sheets['Özet']
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)[0]
  }
  it('pdks.view: tek "İzinli gün" (yarım 0,5 dahil) + ayrı ücretsiz; yıllık/mazeret sütunu YOK', async () => {
    const r = await ozet(false)
    expect(r['İzinli gün']).toBe(2.5)
    expect(r['Ücretsiz izin gün']).toBe(1)
    expect(Object.keys(r)).not.toContain('Yıllık izin gün')
    expect(Object.keys(r)).not.toContain('Mazeret izni gün')
  })
  it('izin.admin: yıllık / mazeret / ücretsiz ayrı', async () => {
    const r = await ozet(true)
    expect([r['Yıllık izin gün'], r['Mazeret izni gün'], r['Ücretsiz izin gün']]).toEqual([1.5, 1, 1])
    expect(Object.keys(r)).not.toContain('İzinli gün')
  })
  it('sütun seçimi', () => {
    expect(izinSutunu({ kod: 'UCRETSIZ', ucretli: false }, true)).toBe('Ücretsiz izin gün')
    expect(izinSutunu({ kod: 'RAPOR', ucretli: true }, false)).toBe('İzinli gün')
    expect(izinSutunu(null, true)).toBe('Mazeret izni gün')
  })
})
