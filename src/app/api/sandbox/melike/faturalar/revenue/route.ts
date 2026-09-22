import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// GET — tüm aylık ciro kayıtları (ay -> € ciro)
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const rows = await prisma.invoiceMonthlyRevenue.findMany({ orderBy: { month: 'asc' } })
    return apiSuccess({
      revenues: rows.map((r) => ({ month: r.month.toISOString().slice(0, 7), revenueEUR: Number(r.revenueEUR) })),
    })
  } catch (error) {
    return apiError('Ciro kayıtları alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/revenue GET',
      error,
    })
  }
}

// PUT — bir ay için ciro gir/güncelle. body: { month: "2026-08", revenueEUR: 1175000 }
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const body = await request.json()
    const { month, revenueEUR } = body

    if (!month || !/^\d{4}-\d{2}$/.test(month)) return apiBadRequest('Geçersiz ay (YYYY-MM bekleniyor)')
    const revenueNum = Number(revenueEUR)
    if (isNaN(revenueNum) || revenueNum < 0) return apiBadRequest('Geçerli bir ciro tutarı gir')

    const monthDate = new Date(`${month}-01T00:00:00.000Z`)

    const revenue = await prisma.invoiceMonthlyRevenue.upsert({
      where: { month: monthDate },
      create: { month: monthDate, revenueEUR: revenueNum, updatedById: user.id },
      update: { revenueEUR: revenueNum, updatedById: user.id },
    })

    return apiSuccess({ revenue: { month, revenueEUR: Number(revenue.revenueEUR) } })
  } catch (error) {
    return apiError('Ciro kaydedilirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/revenue PUT',
      error,
    })
  }
}
