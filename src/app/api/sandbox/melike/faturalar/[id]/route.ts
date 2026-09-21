import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InvoiceCurrency } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiNoContent, apiBadRequest, apiNotFound, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'
import { resolveDepartments, computeAmounts } from '../_lib/invoice'

const CURRENCIES: InvoiceCurrency[] = ['TRY', 'USD', 'EUR']

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

// PATCH — tek bölüme geçiş/düzeltme. body: { departmentOrgUnitId: string | null } (null = Genel)
// NOT: Çoklu bölüm (%) bölünmesi sadece fatura oluşturulurken yapılabiliyor; burada
// bir fatura tek bölüme sabitlenir ve varsa önceki yüzde dağılımı silinir.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { id } = await params
    const body = await request.json()
    const { departmentOrgUnitId } = body

    let departmentName: string | null = null
    if (departmentOrgUnitId) {
      const dept = await prisma.personnel.findFirst({ where: { bolum: departmentOrgUnitId, aktif: true }, select: { bolum: true } })
      if (!dept) return apiBadRequest('Geçersiz bölüm')
      departmentName = dept.bolum
    }

    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (!existing) return apiNotFound('Fatura bulunamadı')

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        departmentOrgUnitId: departmentOrgUnitId || null,
        departmentName,
        allocations: { deleteMany: {} },
      },
      include: { allocations: true },
    })
    return apiSuccess({ invoice })
  } catch (error) {
    return apiError('Fatura güncellenirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/[id] PATCH',
      error,
    })
  }
}

// PUT — faturanın tüm alanlarını düzenle (tarih, firma, fatura no, tutar, para birimi, bölüm/allocations, not).
// € karşılığı yeni tarih/tutar/para birimine göre yeniden hesaplanır.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { id } = await params
    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (!existing) return apiNotFound('Fatura bulunamadı')

    const body = await request.json()
    const { invoiceDate, companyName, invoiceNumber, amount, currency, departmentOrgUnitId, allocations, note } = body

    if (!invoiceDate) return apiBadRequest('Fatura tarihi gerekli')
    if (!companyName?.trim()) return apiBadRequest('Firma adı gerekli')
    if (!invoiceNumber?.trim()) return apiBadRequest('Fatura no gerekli')
    const amountNum = Number(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) return apiBadRequest('Geçerli bir tutar gir')
    if (!CURRENCIES.includes(currency)) return apiBadRequest('Geçersiz para birimi')

    const duplicateNumber = await prisma.invoice.findFirst({
      where: { invoiceNumber: invoiceNumber.trim(), NOT: { id } },
    })
    if (duplicateNumber) return apiBadRequest('Bu fatura no zaten kayıtlı')

    const resolved = await resolveDepartments(departmentOrgUnitId, allocations)
    if (typeof resolved === 'string') return apiBadRequest(resolved)

    const date = new Date(invoiceDate)
    if (isNaN(date.getTime())) return apiBadRequest('Geçersiz tarih')

    const dateStr = invoiceDate.slice(0, 10)
    const { exchangeRate, amountTRY, amountEUR } = await computeAmounts(currency, amountNum, dateStr)

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceDate: date,
        companyName: companyName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        amount: amountNum,
        currency,
        exchangeRate,
        amountTRY,
        amountEUR,
        departmentOrgUnitId: resolved.departmentOrgUnitId,
        departmentName: resolved.departmentName,
        note: note?.trim() || null,
        allocations: {
          deleteMany: {},
          ...(resolved.allocations.length > 0 && {
            create: resolved.allocations.map((d) => ({
              departmentOrgUnitId: d.departmentOrgUnitId,
              departmentName: d.departmentName,
              percentage: d.percentage,
              amountTRY: (amountTRY * d.percentage) / 100,
              amountEUR: (amountEUR * d.percentage) / 100,
            })),
          }),
        },
      },
      include: { allocations: true },
    })

    return apiSuccess({ invoice })
  } catch (error) {
    return apiError('Fatura düzenlenirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/[id] PUT',
      error,
    })
  }
}
