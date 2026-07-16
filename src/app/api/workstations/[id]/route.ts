import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

function prismaErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code
  }
  return undefined
}

/**
 * GET /api/workstations/[id]
 * Tek tezgah + atanmış personel (id, adSoyad, sicilNo).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { id } = await params
    const workstation = await prisma.workstation.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        personnel: {
          include: {
            personnel: { select: { id: true, adSoyad: true, sicilNo: true } },
          },
        },
      },
    })

    if (!workstation) return apiNotFound('Tezgah bulunamadı')
    return apiSuccess(workstation)
  } catch (err) {
    return apiError('Tezgah alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/workstations/[id]',
      error: err,
    })
  }
}

/**
 * PUT /api/workstations/[id]
 * Body: { kod?, ad?, ifsWorkCenterKod?, departmentId?, isActive? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return apiBadRequest('Geçersiz istek gövdesi')
    }

    const { kod, ad, ifsWorkCenterKod, departmentId, isActive } = body as {
      kod?: string
      ad?: string
      ifsWorkCenterKod?: string
      departmentId?: string
      isActive?: boolean
    }

    const data: Record<string, unknown> = {}
    if (typeof kod === 'string') {
      if (!kod.trim()) return apiBadRequest('kod boş olamaz')
      data.kod = kod.trim()
    }
    if (typeof ad === 'string') {
      if (!ad.trim()) return apiBadRequest('ad boş olamaz')
      data.ad = ad.trim()
    }
    if (typeof ifsWorkCenterKod === 'string') {
      if (!ifsWorkCenterKod.trim()) return apiBadRequest('ifsWorkCenterKod boş olamaz')
      data.ifsWorkCenterKod = ifsWorkCenterKod.trim()
    }
    if (typeof departmentId === 'string') {
      if (!departmentId.trim()) return apiBadRequest('departmentId boş olamaz')
      data.departmentId = departmentId.trim()
    }
    if (typeof isActive === 'boolean') data.isActive = isActive

    if (Object.keys(data).length === 0) {
      return apiBadRequest('Güncellenecek alan yok')
    }

    const updated = await prisma.workstation.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { personnel: true } },
      },
    })

    return apiSuccess(updated)
  } catch (err) {
    const code = prismaErrorCode(err)
    if (code === 'P2025') return apiNotFound('Tezgah bulunamadı')
    if (code === 'P2002') return apiError('Bu tezgah kodu zaten kullanılıyor', 409)
    if (code === 'P2003') return apiBadRequest('Geçersiz departman (departmentId bulunamadı)')
    return apiError('Tezgah güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/workstations/[id]',
      error: err,
    })
  }
}

/**
 * DELETE /api/workstations/[id]
 * PersonnelWorkstation FK Cascade → atamalar otomatik silinir.
 * Response bilgi amaçlı silinen atama sayısını içerir (silmeyi engellemez).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { id } = await params

    const existing = await prisma.workstation.findUnique({
      where: { id },
      include: { _count: { select: { personnel: true } } },
    })
    if (!existing) return apiNotFound('Tezgah bulunamadı')

    const removedAssignments = existing._count.personnel

    await prisma.workstation.delete({ where: { id } })

    return apiSuccess({ deleted: true, id, removedAssignments })
  } catch (err) {
    const code = prismaErrorCode(err)
    if (code === 'P2025') return apiNotFound('Tezgah bulunamadı')
    return apiError('Tezgah silinirken bir hata oluştu', 500, {
      endpoint: 'DELETE /api/workstations/[id]',
      error: err,
    })
  }
}
