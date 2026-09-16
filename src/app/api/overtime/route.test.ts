import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- mock'lar ---
const requireUserMock = vi.fn()
vi.mock('@/lib/auth/require-user', () => ({ requireUser: () => requireUserMock() }))

const findMany = vi.fn()
const count = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    overtimeForm: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}))

const resolveAllowedDeptsMock = vi.fn()
vi.mock('@/lib/overtime-performance', () => ({
  resolveAllowedDepts: (...a: unknown[]) => resolveAllowedDeptsMock(...a),
}))

import { GET } from './route'

type WhereShape = {
  formTipi?: string
  OR?: unknown[]
  personnel?: { some?: { workDepartment?: { in?: string[] } } }
}

async function whereFor(
  permissions: string[],
  opts: { personnelId?: string | null } = {}
): Promise<WhereShape> {
  requireUserMock.mockResolvedValue({
    session: { user: { permissions } },
    user: { id: 'u1', personnelId: opts.personnelId ?? null },
    error: null,
  })
  findMany.mockResolvedValue([])
  count.mockResolvedValue(0)
  const res = await GET(new NextRequest('http://localhost/api/overtime?formTipi=MESAI'))
  expect(res.status).toBe(200)
  return findMany.mock.calls[0][0].where as WhereShape
}

beforeEach(() => {
  requireUserMock.mockReset()
  findMany.mockReset()
  count.mockReset()
  resolveAllowedDeptsMock.mockReset()
})

describe('GET /api/overtime — görünürlük önceliği', () => {
  it('overtime.report.all → TÜM formlar (scope filtresi yok)', async () => {
    const where = await whereFor(['overtime.report.all'])
    expect(where.formTipi).toBe('MESAI')
    expect(where.OR).toBeUndefined()
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  // MESAİ-KAPSAM (16.09.2026): forms.admin mesai görünürlüğünü AÇMAZ → self-scope'a düşer.
  it('forms.admin tek başına → self-scope (mesai anahtarı değil)', async () => {
    const where = await whereFor(['forms.admin'])
    expect(where.OR).toBeDefined()
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('overtime.view.all → TÜM formlar salt-okuma (scope filtresi yok)', async () => {
    const where = await whereFor(['overtime.view.all'])
    expect(where.OR).toBeUndefined()
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  // MESAİ-KAPSAM (16.09.2026): view.dept = koltuk kapsamı + self-scope (onaycı kendi
  // bölümü dışındaki bekleyen formu da listede görür).
  it('overtime.view.dept → self-scope OR workDepartment IN allowedDepts', async () => {
    resolveAllowedDeptsMock.mockResolvedValue(['İDARİ İŞLER'])
    const where = await whereFor(['overtime.view.dept'])
    expect(where.personnel).toBeUndefined()
    expect(where.OR).toEqual([
      { createdById: 'u1' },
      { approvals: { some: { OR: [{ approverId: 'u1' }, { escalatedToId: 'u1' }] } } },
      { personnel: { some: { workDepartment: { in: ['İDARİ İŞLER'] } } } },
    ])
  })

  it('view.dept + allowedDepts=[] → yalnız self-scope (bölüm dalı yok)', async () => {
    resolveAllowedDeptsMock.mockResolvedValue([])
    const where = await whereFor(['overtime.view.dept'])
    expect(where.OR).toEqual([
      { createdById: 'u1' },
      { approvals: { some: { OR: [{ approverId: 'u1' }, { escalatedToId: 'u1' }] } } },
    ])
  })

  it('view.dept + allowedDepts=undefined (kapsam sınırsız) → filtre yok', async () => {
    resolveAllowedDeptsMock.mockResolvedValue(undefined)
    const where = await whereFor(['overtime.view.dept'])
    expect(where.personnel).toBeUndefined()
    expect(where.OR).toBeUndefined()
  })

  it('öncelik: report.all > view.dept (report.all kazanır, resolveAllowedDepts çağrılmaz)', async () => {
    const where = await whereFor(['overtime.report.all', 'overtime.view.dept'])
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('öncelik: view.all > view.dept (view.all kazanır)', async () => {
    const where = await whereFor(['overtime.view.all', 'overtime.view.dept'])
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('permission YOK + personnelId var → self-scope (3 dal: creator/approver/personnel)', async () => {
    const where = await whereFor([], { personnelId: 'p1' })
    expect(Array.isArray(where.OR)).toBe(true)
    expect(where.OR).toHaveLength(3)
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('permission YOK + personnelId YOK → self-scope (2 dal, personnel dalı yok)', async () => {
    const where = await whereFor([], { personnelId: null })
    expect(where.OR).toHaveLength(2)
  })
})
