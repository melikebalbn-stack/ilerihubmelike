import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { apiSuccess, apiError, apiCreated, apiBadRequest } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

function prismaErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code
  }
  return undefined
}

/**
 * GET /api/workstations
 * Tüm tezgahlar — department (ad) + atanmış personel sayısı (_count).
 * Query: ?bolum= (departmentId veya department.name), ?includeInactive
 */
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const bolum = searchParams.get('bolum')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Record<string, unknown> = {}
    if (!includeInactive) where.isActive = true
    if (bolum) {
      where.OR = [
        { departmentId: bolum },
        { department: { name: { contains: bolum, mode: 'insensitive' } } },
      ]
    }

    const workstations = await prisma.workstation.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { kod: 'asc' }],
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { personnel: true } },
      },
    })

    return apiSuccess(workstations)
  } catch (err) {
    return apiError('Tezgahlar alınırken bir hata oluştu', 500, {
      endpoint: 'GET /api/workstations',
      error: err,
    })
  }
}

/**
 * POST /api/workstations
 * Body: { kod, ad, ifsWorkCenterKod, departmentId, isActive? }
 */
export async function POST(request: NextRequest) {
  const { error } = await requirePermission('uretim.tezgah.manage')
  if (error) return error

  try {
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

    if (!kod?.trim() || !ad?.trim() || !ifsWorkCenterKod?.trim() || !departmentId?.trim()) {
      return apiBadRequest('kod, ad, ifsWorkCenterKod ve departmentId zorunludur')
    }

    const created = await prisma.workstation.create({
      data: {
        kod: kod.trim(),
        ad: ad.trim(),
        ifsWorkCenterKod: ifsWorkCenterKod.trim(),
        departmentId: departmentId.trim(),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { personnel: true } },
      },
    })

    return apiCreated(created)
  } catch (err) {
    const code = prismaErrorCode(err)
    if (code === 'P2002') {
      return apiError('Bu tezgah kodu zaten kullanılıyor', 409)
    }
    if (code === 'P2003') {
      return apiBadRequest('Geçersiz departman (departmentId bulunamadı)')
    }
    return apiError('Tezgah oluşturulurken bir hata oluştu', 500, {
      endpoint: 'POST /api/workstations',
      error: err,
    })
  }
}
