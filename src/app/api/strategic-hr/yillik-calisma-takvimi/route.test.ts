import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requirePermissionMock = vi.fn()
const findManyMock = vi.fn()

vi.mock('@/lib/auth/require-permission', () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { yillikTakvimKaydi: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}))

import { GET } from './route'

beforeEach(() => {
  requirePermissionMock.mockReset()
  findManyMock.mockReset()
})

describe('Yıllık Çalışma Takvimi GET', () => {
  it('view/admin yoksa 403 döner ve DB sorgulamaz', async () => {
    requirePermissionMock.mockResolvedValue({ error: NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 }) })
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=2026'))
    expect(response.status).toBe(403)
    expect(requirePermissionMock).toHaveBeenCalledWith(['yilliktakvim.view', 'yilliktakvim.admin'])
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('view/admin kontrolünden sonra yalnız seçili alanları okur', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'u1' })
    findManyMock.mockResolvedValue([])
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=2026'))
    expect(response.status).toBe(200)
    expect(findManyMock).toHaveBeenCalledOnce()
    expect(findManyMock.mock.calls[0][0].where).toEqual({ yil: 2026, arsivMi: false })
    expect(findManyMock.mock.calls[0][0].select.katilimcilar.select.user.select).toEqual({ name: true })
  })

  it('geçersiz yılı DB sorgusundan önce reddeder', async () => {
    requirePermissionMock.mockResolvedValue({ error: null, userId: 'u1' })
    const response = await GET(new NextRequest('http://localhost/api/strategic-hr/yillik-calisma-takvimi?yil=1999'))
    expect(response.status).toBe(400)
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
