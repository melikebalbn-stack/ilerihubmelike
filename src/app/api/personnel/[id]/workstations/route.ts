import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError, apiBadRequest, apiNotFound } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/personnel/[id]/workstations
 * Bu personelin atanmış tezgahları (workstation: id, kod, ad, department).
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
      where: { personnelId: id },
      include: {
        workstation: {
          select: {
            id: true,
            kod: true,
            ad: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { workstation: { kod: 'asc' } },
    })

    return apiSuccess(links.map((l) => l.workstation))
  } catch (err) {
    return apiError('Personel tezgahları alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/personnel/[id]/workstations',
      error: err,
    })
  }
}

/**
 * PUT /api/personnel/[id]/workstations  (set-based: tümünü değiştir)
 * Body: { workstationIds: string[] }
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
    const workstationIds = (body as { workstationIds?: unknown } | null)?.workstationIds
    if (!Array.isArray(workstationIds) || workstationIds.some((w) => typeof w !== 'string')) {
      return apiBadRequest('workstationIds string dizisi olmalı')
    }

    // Personel var mı?
    const personnel = await prisma.personnel.findUnique({ where: { id }, select: { id: true } })
    if (!personnel) return apiNotFound('Personel bulunamadı')

    const uniqueIds = [...new Set(workstationIds as string[])]

    const [, createResult] = await prisma.$transaction([
      prisma.personnelWorkstation.deleteMany({ where: { personnelId: id } }),
      prisma.personnelWorkstation.createMany({
        data: uniqueIds.map((wid) => ({ personnelId: id, workstationId: wid })),
        skipDuplicates: true,
      }),
    ])

    return apiSuccess({ personnelId: id, assignedCount: createResult.count })
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
    if (code === 'P2003') return apiBadRequest('Geçersiz tezgah (workstationId bulunamadı)')
    return apiError('Tezgah ataması güncellenirken bir hata oluştu', 500, {
      endpoint: 'PUT /api/personnel/[id]/workstations',
      error: err,
    })
  }
}
