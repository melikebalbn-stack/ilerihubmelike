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
  it('forms.admin → TÜM formlar (scope filtresi yok)', async () => {
    const where = await whereFor(['forms.admin'])
    expect(where.formTipi).toBe('MESAI')
    expect(where.OR).toBeUndefined()
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('overtime.view.all → TÜM formlar salt-okuma (scope filtresi yok)', async () => {
    const where = await whereFor(['overtime.view.all'])
    expect(where.OR).toBeUndefined()
    expect(where.personnel).toBeUndefined()
    expect(resolveAllowedDeptsMock).not.toHaveBeenCalled()
  })

  it('overtime.view.dept → workDepartment IN allowedDepts (self-scope YOK)', async () => {
    resolveAllowedDeptsMock.mockResolvedValue(['İDARİ İŞLER'])
    const where = await whereFor(['overtime.view.dept'])
    expect(where.personnel).toEqual({ some: { workDepartment: { in: ['İDARİ İŞLER'] } } })
    expect(where.OR).toBeUndefined()
  })

  it('view.dept + allowedDepts=[] → in:[] (hiçbir form eşleşmez → boş liste)', async () => {
    resolveAllowedDeptsMock.mockResolvedValue([])
    const where = await whereFor(['overtime.view.dept'])
    expect(where.personnel).toEqual({ some: { workDepartment: { in: [] } } })
  })

  it('view.dept + allowedDepts=undefined (kapsam sınırsız) → filtre yok', async () => {
    resolveAllowedDeptsMock.mockResolvedValue(undefined)
    const where = await whereFor(['overtime.view.dept'])
    expect(where.personnel).toBeUndefined()
    expect(where.OR).toBeUndefined()
  })

  it('öncelik: forms.admin > view.dept (admin kazanır, resolveAllowedDepts çağrılmaz)', async () => {
    const where = await whereFor(['forms.admin', 'overtime.view.dept'])
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
