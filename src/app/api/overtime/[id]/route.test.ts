import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- mock'lar ---
const requireUserMock = vi.fn()
vi.mock('@/lib/auth/require-user', () => ({ requireUser: () => requireUserMock() }))

const formFindUnique = vi.fn()
const userFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    overtimeForm: { findUnique: (...a: unknown[]) => formFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), findMany: vi.fn().mockResolvedValue([]) },
    permissionAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

const resolveAllowedDeptsMock = vi.fn()
vi.mock('@/lib/overtime-performance', () => ({
  resolveAllowedDepts: (...a: unknown[]) => resolveAllowedDeptsMock(...a),
}))

import { GET } from './route'

// Fabrika geneli form: kullanıcının koltuğu dışında, creator/personel değil.
function formWith(approvals: { approverId: string | null; escalatedToId: string | null; decision: string | null }[]) {
  return {
    id: 'f1',
    formNo: 'OT-TEST',
    status: 'APPROVED',
    createdById: 'creator',
    personnel: [{ id: 'p1', personnelId: 'pers-x', workDepartment: 'Kaynakhane', uretimSatirlari: [] }],
    approvals: approvals.map((a, i) => ({ id: `a${i}`, step: i + 1, ...a })),
  }
}

async function statusFor(permissions: string[], approvals: Parameters<typeof formWith>[0]) {
  requireUserMock.mockResolvedValue({
    session: { user: { permissions } },
    user: { id: 'u1', personnelId: 'pers-u1' },
    error: null,
  })
  formFindUnique.mockResolvedValue(formWith(approvals))
  userFindUnique.mockResolvedValue({ personnel: { gorev: 'MEMUR' } })
  resolveAllowedDeptsMock.mockResolvedValue(['İNSAN VARLIKLARI MÜDÜRLÜĞÜ']) // koltuk kapsamı formu kapsamıyor
  const res = await GET(new NextRequest('http://localhost/api/overtime/f1'), { params: Promise.resolve({ id: 'f1' }) })
  return res.status
}

beforeEach(() => {
  requireUserMock.mockReset()
  formFindUnique.mockReset()
  userFindUnique.mockReset()
  resolveAllowedDeptsMock.mockReset()
})

// MESAİ-KAPSAM (18.09.2026): detay erişimi liste (route.ts self-scope) ve approve ucuyla AYNI
// onaycı kuralını uygular — asıl (approverId) VEYA eskale yedek (escalatedToId).
describe('GET /api/overtime/[id] — onaycı erişimi', () => {
  it('asıl onaycı (approverId) → 200', async () => {
    expect(await statusFor([], [{ approverId: 'u1', escalatedToId: null, decision: 'APPROVED' }])).toBe(200)
  })

  it('yedek onaycı (escalatedToId) → 200 (listede gördüğü formu açabilmeli)', async () => {
    expect(await statusFor([], [{ approverId: 'baska', escalatedToId: 'u1', decision: null }])).toBe(200)
  })

  it('onay zincirinde olmayan, kapsam dışı → 403', async () => {
    expect(await statusFor([], [{ approverId: 'baska', escalatedToId: 'yedek-baska', decision: null }])).toBe(403)
  })

  it('overtime.report.all → 200 (kapsam sınırsız)', async () => {
    expect(await statusFor(['overtime.report.all'], [{ approverId: 'baska', escalatedToId: null, decision: null }])).toBe(200)
  })
})
