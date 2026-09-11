import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiNoContent, apiBadRequest, apiNotFound, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'

// DELETE — fatura kaydını sil
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { id } = await params
    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (!existing) return apiNotFound('Fatura bulunamadı')

    await prisma.invoice.delete({ where: { id } })
    return apiNoContent()
  } catch (error) {
    return apiError('Fatura silinirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/[id] DELETE',
      error,
    })
  }
}

// PATCH — sadece kategori güncelleme (Genel <-> Sistem Geliştirme)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { id } = await params
    const body = await request.json()
    const { category } = body

    if (!['GENEL', 'SISTEM_GELISTIRME'].includes(category)) {
      return apiBadRequest('Geçersiz kategori')
    }

    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (!existing) return apiNotFound('Fatura bulunamadı')

    const invoice = await prisma.invoice.update({ where: { id }, data: { category } })
    return apiSuccess({ invoice })
  } catch (error) {
    return apiError('Fatura güncellenirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/[id] PATCH',
      error,
    })
  }
}
