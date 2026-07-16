import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/workstations/[id]/personnel
 * Bu tezgaha atanmış personel (id, adSoyad, sicilNo, bolum).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { id } = await params

    const links = await prisma.personnelWorkstation.findMany({
      where: { workstationId: id },
      include: {
        personnel: { select: { id: true, adSoyad: true, sicilNo: true, bolum: true } },
      },
      orderBy: { personnel: { adSoyad: 'asc' } },
    })

    return apiSuccess(links.map((l) => l.personnel))
  } catch (err) {
    return apiError('Atanmış personel alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/workstations/[id]/personnel',
      error: err,
    })
  }
}

/**
 * PUT /api/workstations/[id]/personnel  (set-based: tümünü değiştir)
 * Body: { personnelIds: string[] }
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
    const personnelIds = (body as { personnelIds?: unknown } | null)?.personnelIds
    if (!Array.isArray(personnelIds) || personnelIds.some((p) => typeof p !== 'string')) {
      return apiBadRequest('personnelIds string dizisi olmalı')
    }

    // Tezgah var mı?
    const workstation = await prisma.workstation.findUnique({ where: { id }, select: { id: true } })
    if (!workstation) return apiNotFound('Tezgah bulunamadı')

    const uniqueIds = [...new Set(personnelIds as string[])]

    const [, createResult] = await prisma.$transaction([
      prisma.personnelWorkstation.deleteMany({ where: { workstationId: id } }),
      prisma.personnelWorkstation.createMany({
        data: uniqueIds.map((pid) => ({ workstationId: id, personnelId: pid })),
        skipDuplicates: true,
      }),
    ])

    return apiSuccess({ workstationId: id, assignedCount: createResult.count })
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
    if (code === 'P2003') return apiBadRequest('Geçersiz personel (personnelId bulunamadı)')
    return apiError('Personel ataması güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/workstations/[id]/personnel',
      error: err,
    })
  }
}
