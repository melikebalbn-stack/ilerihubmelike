import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// GET ?q=... — daha önce girilen firma adlarından öneri listesi (3+ karakterden itibaren)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''
    if (q.length < 3) return apiSuccess({ companies: [] })

    const rows = await prisma.invoice.findMany({
      where: { companyName: { contains: q, mode: 'insensitive' } },
      select: { companyName: true },
      distinct: ['companyName'],
      take: 8,
      orderBy: { companyName: 'asc' },
    })

    return apiSuccess({ companies: rows.map((r) => r.companyName) })
  } catch (error) {
    return apiError('Firma önerileri alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/companies',
      error,
    })
  }
}
