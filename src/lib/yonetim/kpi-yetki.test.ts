import { describe, it, expect, vi, beforeEach } from 'vitest'

// Yönetim → KPI yetki çözümü (22.09.2026): görüntüleme kpi.view ∨ kpi.manage ∨ koltuk;
// yazma manage ∨ (koltuk ∧ orgUnit koltuk ağacında).
const perms = vi.fn<() => Promise<Set<string>>>()
const koltukDeptler = vi.fn<() => Promise<{ id: string; name: string }[]>>()
const deptDefFindMany = vi.fn()

vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: () => perms() }))
vi.mock('@/lib/overtime-performance', () => ({ resolveMudurKoltukDeptler: () => koltukDeptler() }))
vi.mock('@/lib/prisma', () => ({ prisma: { departmentDefinition: { findMany: (...a: unknown[]) => deptDefFindMany(...a) } } }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { kpiYetkisiCoz, kpiYazabilirMi } from './kpi-yetki'

beforeEach(() => {
  perms.mockReset(); koltukDeptler.mockReset(); deptDefFindMany.mockReset()
})

describe('kpiYetkisiCoz', () => {
  it('kpi.manage → görüntüle + manage, yazma kapsamı sınırsız (null); koltuk sorgulanmaz', async () => {
    perms.mockResolvedValue(new Set(['kpi.manage']))
    const y = await kpiYetkisiCoz('u')
    expect(y).toEqual({ goruntule: true, manage: true, yazilabilirOrgUnitIdler: null })
    expect(koltukDeptler).not.toHaveBeenCalled()
    expect(kpiYazabilirMi(y, 'herhangi')).toBe(true)
  })
  it('kpi.view (koltuksuz) → görüntüle, yazma yok (mevcut davranış)', async () => {
    perms.mockResolvedValue(new Set(['kpi.view']))
    koltukDeptler.mockResolvedValue([])
    const y = await kpiYetkisiCoz('u')
    expect(y).toEqual({ goruntule: true, manage: false, yazilabilirOrgUnitIdler: [] })
    expect(kpiYazabilirMi(y, 'ou1')).toBe(false)
  })
  it('müdür koltuğu (izinsiz) → görüntüle TÜMÜ, yazma yalnız koltuk ağacının orgUnit\'leri', async () => {
    perms.mockResolvedValue(new Set())
    koltukDeptler.mockResolvedValue([{ id: 'd1', name: 'Fabrika' }, { id: 'd2', name: 'Preshane' }])
    deptDefFindMany.mockResolvedValue([{ orgUnitId: 'ouF' }, { orgUnitId: 'ouF' }])
    const y = await kpiYetkisiCoz('u')
    expect(y).toEqual({ goruntule: true, manage: false, yazilabilirOrgUnitIdler: ['ouF'] })
    expect(deptDefFindMany).toHaveBeenCalledWith({ where: { id: { in: ['d1', 'd2'] }, orgUnitId: { not: null } }, select: { orgUnitId: true } })
    expect(kpiYazabilirMi(y, 'ouF')).toBe(true)
    expect(kpiYazabilirMi(y, 'ouKalite')).toBe(false)
  })
  it('izinsiz + koltuksuz → görüntüleme yok', async () => {
    perms.mockResolvedValue(new Set())
    koltukDeptler.mockResolvedValue([])
    expect(await kpiYetkisiCoz('u')).toEqual({ goruntule: false, manage: false, yazilabilirOrgUnitIdler: [] })
  })
  it('koltuk var ama orgUnitId eşlemesi boş → görüntüler (koltuk kuralı), yazamaz', async () => {
    perms.mockResolvedValue(new Set())
    koltukDeptler.mockResolvedValue([{ id: 'd1', name: 'X' }])
    deptDefFindMany.mockResolvedValue([])
    expect(await kpiYetkisiCoz('u')).toEqual({ goruntule: true, manage: false, yazilabilirOrgUnitIdler: [] })
  })
})
