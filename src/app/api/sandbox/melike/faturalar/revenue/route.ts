import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// GET — tek ciro değeri (henüz girilmemişse null)
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const setting = await prisma.invoiceRevenueSetting.findUnique({ where: { id: 'singleton' } })
    return apiSuccess({ totalRevenueEUR: setting ? Number(setting.totalRevenueEUR) : null })
  } catch (error) {
    return apiError('Ciro alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/revenue GET',
      error,
    })
  }
}

// PUT — ciro değerini gir/güncelle. body: { totalRevenueEUR: 1175000 }
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const body = await request.json()
    const revenueNum = Number(body.totalRevenueEUR)
    if (isNaN(revenueNum) || revenueNum < 0) return apiBadRequest('Geçerli bir ciro tutarı gir')

    const setting = await prisma.invoiceRevenueSetting.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', totalRevenueEUR: revenueNum, updatedById: user.id },
      update: { totalRevenueEUR: revenueNum, updatedById: user.id },
    })

    return apiSuccess({ totalRevenueEUR: Number(setting.totalRevenueEUR) })
  } catch (error) {
    return apiError('Ciro kaydedilirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/revenue PUT',
      error,
    })
  }
}
