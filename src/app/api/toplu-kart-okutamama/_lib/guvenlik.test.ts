// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Kart Okutamama — GÜVENLİK akışı + İV onayı sırası (28.09, İV kararları):
 *  - kart_okutamama.guvenlik izni → GUVENLIK seviyesi (personelli / personelsiz; İV ise FULL kalır)
 *  - güvenliğin açtığı kayıt BEKLIYOR + personelin AMİRLERİ (müdür muafiyeti uygulanmaz); amir yoksa orphan
 *  - liste yalnız KENDİ açtıkları; amir kararından sonra düzenleme/silme 403; kişi değiştirme 400
 *  - export / istatistik / import 403
 *  - İV onayı amir ONAYLANDI değilse 409 (hiçbir kayıt onaylanmaz); mevcut başkası-adına → ONAYLANDI kuralı değişmedi
 */
type Row = Record<string, unknown>
const s = vi.hoisted(() => ({
  userId: 'u-g',
  users: {} as Record<string, { personnelId: string | null; role: string; izinler: string[] }>,
  personnel: {} as Record<string, Row>,
  kayitlar: [] as Row[],
  onaycilar: {} as Record<string, [string | null, string | null, string | null]>,
  muaflar: new Set<string>(),
  ivBolumu: new Set<string>(),
  seq: 0,
}))

vi.mock('@/lib/auth/require-user', () => ({
  requireUser: async () => ({ user: { id: s.userId, name: 'Kullanıcı', email: 'x@y' }, error: null }),
}))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: async (id: string) => new Set(s.users[id]?.izinler ?? []) }))
vi.mock('@/lib/auth/iv-bolum-fk', () => ({ isIvBolumuFk: async (dep: string | null) => !!dep && s.ivBolumu.has(dep) }))
vi.mock('@/lib/onay/muafiyet', () => ({ selfEntryOnaydanMuafMi: async (pid: string) => s.muaflar.has(pid) }))
vi.mock('@/lib/onay/yonetici-cozumu', () => ({
  resolveApprovers: async (pid: string) => {
    const [a, b, c] = s.onaycilar[pid] ?? [null, null, null]
    return { approverId: a, approverId2: b, approverId3: c }
  },
  getManagedPersonnelIds: async () => [],
}))
vi.mock('./notify-hr', () => ({
  notifyHrOfBulkCardScanRecords: vi.fn(), notifyApproverOfPendingRecord: vi.fn(), notifyHrManagerOfUnresolvedApprover: vi.fn(),
}))
vi.mock('./duplicate-check', () => ({ hasDuplicateRecord: async () => false, DUPLICATE_ERROR_MESSAGE: 'mükerrer' }))
vi.mock('@/lib/prisma', () => {
  const uyar = (r: Row, w: Row = {}): boolean =>
    Object.entries(w).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((x) => uyar(r, x))
      if (k === 'AND') return (v as Row[]).every((x) => uyar(r, x))
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const o = v as Row
        if ('in' in o) return (o.in as unknown[]).includes(r[k])
        if ('not' in o) return r[k] !== o.not
        return true // tarih aralığı / ilişki filtreleri bu testlerde kullanılmıyor
      }
      return (r[k] ?? null) === v
    })
  return {
    prisma: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const u = s.users[where.id]
          if (!u) return null
          const p = u.personnelId ? s.personnel[u.personnelId] : null
          return { role: u.role, personnelId: u.personnelId, personnel: p ? { id: p.id, yakaRengi: p.yakaRengi, bolum: p.bolum, departmentId: p.departmentId } : null }
        },
      },
      personnel: { findUnique: async ({ where }: { where: { id: string } }) => s.personnel[where.id] ?? null },
      bulkCardScanBolumYetki: { findUnique: async () => null },
      bulkCardScanFailure: {
        create: async ({ data }: { data: Row }) => {
          const r = { id: `k${++s.seq}`, ivOnaylandi: false, ...data }
          s.kayitlar.push(r)
          return r
        },
        findMany: async ({ where }: { where?: Row }) => s.kayitlar.filter((r) => uyar(r, where)),
        count: async ({ where }: { where?: Row }) => s.kayitlar.filter((r) => uyar(r, where)).length,
        findUnique: async ({ where }: { where: { id: string } }) => s.kayitlar.find((r) => r.id === where.id) ?? null,
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const rs = s.kayitlar.filter((r) => uyar(r, where))
          rs.forEach((r) => Object.assign(r, data))
          return { count: rs.length }
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const i = s.kayitlar.findIndex((r) => r.id === where.id)
          return s.kayitlar.splice(i, 1)[0]
        },
      },
    },
  }
})

import { getBulkCardScanAccess } from './access'
import { onayKarariBelirle } from './approvers'
import { GET as listele, POST as ac } from '../route'
import { DELETE as sil, PUT as duzenle } from '../[id]/route'
import { GET as exportGET } from '../export/route'
import { GET as istatistikGET } from '../istatistik/route'
import { POST as importPOST } from '../import/route'
import { POST as ivOnay } from '../iv-onay/route'

const istek = (url: string, body?: unknown, method = body ? 'POST' : 'GET') =>
  new NextRequest(`http://x${url}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  s.userId = 'u-g'
  s.seq = 0
  s.kayitlar = []
  s.muaflar = new Set(['p-mudur'])
  s.ivBolumu = new Set(['dep-iv'])
  s.personnel = {
    'p-c': { id: 'p-c', sicilNo: 'S-C', adSoyad: 'Çalışan', aktif: true, yakaRengi: 'MAVI', bolum: 'Pres', departmentId: 'dep1' },
    'p-mudur': { id: 'p-mudur', sicilNo: 'S-M', adSoyad: 'Müdür', aktif: true, yakaRengi: 'BEYAZ', bolum: 'Pres', departmentId: 'dep1' },
    'p-yok': { id: 'p-yok', sicilNo: 'S-Y', adSoyad: 'Amirsiz', aktif: true, yakaRengi: 'MAVI', bolum: 'X', departmentId: 'dep1' },
    'p-gv': { id: 'p-gv', sicilNo: 'S-G', adSoyad: 'Güvenlik Personeli', aktif: true, yakaRengi: 'MAVI', bolum: 'Güvenlik', departmentId: 'dep1' },
    'p-iv': { id: 'p-iv', sicilNo: 'S-I', adSoyad: 'İV', aktif: true, yakaRengi: 'BEYAZ', bolum: 'İV', departmentId: 'dep-iv' },
  }
  s.users = {
    'u-g': { personnelId: null, role: 'EMPLOYEE', izinler: ['kart_okutamama.guvenlik'] }, // personelsiz hesap
    'u-g2': { personnelId: 'p-gv', role: 'EMPLOYEE', izinler: ['kart_okutamama.guvenlik'] }, // personelli (mavi yaka)
    'u-iv': { personnelId: 'p-iv', role: 'EMPLOYEE', izinler: ['kart_okutamama.guvenlik'] }, // İV + izin → FULL
    'u-amir': { personnelId: 'p-mudur', role: 'EMPLOYEE', izinler: [] },
  }
  s.onaycilar = { 'p-c': ['u-amir', null, null], 'p-mudur': ['u-gm', null, null], 'p-yok': [null, null, null] }
})

describe('erişim seviyesi', () => {
  it('güvenlik izni → GUVENLIK (personelsiz ve personelli mavi yaka); İV departmanı FULL kalır', async () => {
    expect((await getBulkCardScanAccess('u-g')).level).toBe('GUVENLIK')
    expect((await getBulkCardScanAccess('u-g2')).level).toBe('GUVENLIK') // izin yokken mavi yaka NONE olurdu
    expect((await getBulkCardScanAccess('u-iv')).level).toBe('FULL')
  })
})

describe('onay kuralı', () => {
  it('güvenlik → BEKLIYOR + amir; müdür muafiyeti uygulanmaz; eski "başkası adına → ONAYLANDI" değişmedi', async () => {
    expect(await onayKarariBelirle('p-c', null, { guvenlik: true })).toEqual({ onayDurumu: 'BEKLIYOR', approverId: 'u-amir', approverId2: null, approverId3: null })
    expect((await onayKarariBelirle('p-mudur', 'p-mudur', { guvenlik: true })).onayDurumu).toBe('BEKLIYOR')
    expect((await onayKarariBelirle('p-c', 'p-baska')).onayDurumu).toBe('ONAYLANDI')
    expect((await onayKarariBelirle('p-mudur', 'p-mudur')).onayDurumu).toBe('ONAYLANDI') // muaf kendi girişi
  })
})

describe('güvenlik uçları', () => {
  it('herhangi bir personel adına açar → BEKLIYOR/amir; amirsiz kişi orphan; liste yalnız kendi açtıkları', async () => {
    const r1 = await ac(istek('/api/toplu-kart-okutamama', { personnelId: 'p-c', tarih: '2026-09-28', girisSaati: '07:55' }))
    expect(r1.status).toBe(201)
    expect(await r1.json()).toMatchObject({ onayDurumu: 'BEKLIYOR', approverId: 'u-amir', createdById: 'u-g' })
    const r2 = await ac(istek('/api/toplu-kart-okutamama', { personnelId: 'p-yok', tarih: '2026-09-28', cikisSaati: '17:05' }))
    expect(await r2.json()).toMatchObject({ onayDurumu: 'BEKLIYOR', approverId: null, approverId2: null, approverId3: null })
    s.kayitlar.push({ id: 'baska', personnelId: 'p-c', createdById: 'u-baska', onayDurumu: 'ONAYLANDI', ivOnaylandi: false })
    const liste = await (await listele(istek('/api/toplu-kart-okutamama?kapsam=ekip'))).json()
    expect(liste.accessLevel).toBe('GUVENLIK')
    expect(liste.records.map((r: Row) => r.id)).toEqual(['k1', 'k2'])
  })

  it('amir kararından sonra düzenleme/silme 403; BEKLIYOR iken silinir; kişi değiştirilemez', async () => {
    await ac(istek('/api/toplu-kart-okutamama', { personnelId: 'p-c', tarih: '2026-09-28', girisSaati: '07:55' }))
    expect((await duzenle(istek('/api/toplu-kart-okutamama/k1', { personnelId: 'p-mudur' }, 'PUT'), params('k1'))).status).toBe(400)
    s.kayitlar[0].onayDurumu = 'ONAYLANDI'
    expect((await duzenle(istek('/api/toplu-kart-okutamama/k1', { girisSaati: '08:00' }, 'PUT'), params('k1'))).status).toBe(403)
    expect((await sil(istek('/api/toplu-kart-okutamama/k1', undefined, 'DELETE'), params('k1'))).status).toBe(403)
    s.kayitlar[0].onayDurumu = 'BEKLIYOR'
    expect((await sil(istek('/api/toplu-kart-okutamama/k1', undefined, 'DELETE'), params('k1'))).status).toBe(200)
  })

  it('export / istatistik / import 403', async () => {
    expect((await exportGET(istek('/api/toplu-kart-okutamama/export'))).status).toBe(403)
    expect((await istatistikGET(istek('/api/toplu-kart-okutamama/istatistik'))).status).toBe(403)
    const fd = new FormData()
    const imp = new NextRequest('http://x/api/toplu-kart-okutamama/import', { method: 'POST', body: fd })
    expect((await importPOST(imp)).status).toBe(403)
  })
})

describe('İV onayı amir kararından SONRA', () => {
  const kayit = (id: string, onayDurumu: string) => s.kayitlar.push({ id, personnelId: 'p-c', createdById: 'u-g', onayDurumu, ivOnaylandi: false })
  it('amir BEKLIYOR / REDDEDILDI → 409, hiçbir kayıt onaylanmaz; ONAYLANDI → onaylanır', async () => {
    s.userId = 'u-iv'
    kayit('a', 'ONAYLANDI')
    kayit('b', 'BEKLIYOR')
    kayit('c', 'REDDEDILDI')
    const r = await ivOnay(istek('/api/toplu-kart-okutamama/iv-onay', { ids: ['a', 'b', 'c'] }))
    expect(r.status).toBe(409)
    const d = await r.json()
    expect(d.errors.map((e: Row) => e.id)).toEqual(['b', 'c'])
    expect(d.error).toMatch(/amir/)
    expect(s.kayitlar.every((x) => x.ivOnaylandi === false)).toBe(true)
    const ok = await ivOnay(istek('/api/toplu-kart-okutamama/iv-onay', { ids: ['a'] }))
    expect(ok.status).toBe(200)
    expect(s.kayitlar.find((x) => x.id === 'a')!.ivOnaylandi).toBe(true)
  })
  it('güvenlik İV onayı veremez (403)', async () => {
    kayit('a', 'ONAYLANDI')
    expect((await ivOnay(istek('/api/toplu-kart-okutamama/iv-onay', { ids: ['a'] }))).status).toBe(403)
  })
})
