import { NextRequest } from 'next/server'
import { InvoiceCurrency } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { getRateForDate } from '../_lib/tcmb'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'

const SUPPORTED: InvoiceCurrency[] = ['TRY', 'USD', 'EUR']

// GET ?date=YYYY-MM-DD&currency=EUR — o tarihe (veya en yakın önceki iş gününe) ait TCMB döviz alış kurunu getir
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const currency = (searchParams.get('currency') || 'EUR').toUpperCase()

    if (!SUPPORTED.includes(currency as InvoiceCurrency)) {
      return apiBadRequest('Desteklenmeyen para birimi')
    }
    if (!dateParam) return apiBadRequest('date parametresi gerekli')
    if (isNaN(new Date(dateParam).getTime())) return apiBadRequest('Geçersiz tarih')

    const result = await getRateForDate(dateParam, currency as InvoiceCurrency)
    return apiSuccess({ ...result, date: dateParam, currency })
  } catch (error) {
    return apiError('TCMB kuru alınırken bir hata oluştu', 502, {
      endpoint: 'finans/faturalar/tcmb-rate',
      error,
    })
  }
}
