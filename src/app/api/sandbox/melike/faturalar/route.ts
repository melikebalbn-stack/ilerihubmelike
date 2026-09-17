import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InvoiceCurrency, Prisma } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiCreated, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from './_lib/access'
import { resolveDepartments, computeAmounts } from './_lib/invoice'

const CURRENCIES: InvoiceCurrency[] = ['TRY', 'USD', 'EUR']

// GET ?department=<orgUnitId>|GENEL&search= — fatura listesi
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')
    const search = searchParams.get('search')?.trim()

    const where: Prisma.InvoiceWhereInput = {}
    if (department === 'GENEL') {
      where.departmentOrgUnitId = null
      where.allocations = { none: {} }
    } else if (department) {
      where.OR = [
        { departmentOrgUnitId: department },
        { allocations: { some: { departmentOrgUnitId: department } } },
      ]
    }
    if (search) {
      const searchFilter: Prisma.InvoiceWhereInput = {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
        ],
      }
      // department filtresi zaten OR kullanıyorsa, arama ile birlikte AND'e sar
      if (where.OR) {
        const departmentFilter = { OR: where.OR }
        delete where.OR
        where.AND = [departmentFilter, searchFilter]
      } else {
        where.OR = searchFilter.OR
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: { allocations: { orderBy: { percentage: 'desc' } } },
      orderBy: { invoiceDate: 'desc' },
    })

    return apiSuccess({ invoices })
  } catch (error) {
    return apiError('Faturalar alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar GET',
      error,
    })
  }
}

// POST — yeni fatura kaydı (€ karşılığı bu endpoint içinde TCMB kuruna göre hesaplanır)
// Tek bölüm: departmentOrgUnitId. Birden fazla bölüm: allocations: [{ departmentOrgUnitId, percentage }] (toplam %100)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const body = await request.json()
    const { invoiceDate, companyName, invoiceNumber, amount, currency, departmentOrgUnitId, allocations, note } = body

    if (!invoiceDate) return apiBadRequest('Fatura tarihi gerekli')
    if (!companyName?.trim()) return apiBadRequest('Firma adı gerekli')
    if (!invoiceNumber?.trim()) return apiBadRequest('Fatura no gerekli')
    const amountNum = Number(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) return apiBadRequest('Geçerli bir tutar gir')
    if (!CURRENCIES.includes(currency)) return apiBadRequest('Geçersiz para birimi')

    const resolved = await resolveDepartments(departmentOrgUnitId, allocations)
    if (typeof resolved === 'string') return apiBadRequest(resolved)

    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: invoiceNumber.trim() } })
    if (existing) return apiBadRequest('Bu fatura no zaten kayıtlı')

    const date = new Date(invoiceDate)
    if (isNaN(date.getTime())) return apiBadRequest('Geçersiz tarih')

    const dateStr = invoiceDate.slice(0, 10)
    const { exchangeRate, amountTRY, amountEUR } = await computeAmounts(currency, amountNum, dateStr)

    const invoice = await prisma.invoice.create({
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
        createdById: user.id,
        ...(resolved.allocations.length > 0 && {
          allocations: {
            create: resolved.allocations.map((d) => ({
              departmentOrgUnitId: d.departmentOrgUnitId,
              departmentName: d.departmentName,
              percentage: d.percentage,
              amountTRY: (amountTRY * d.percentage) / 100,
              amountEUR: (amountEUR * d.percentage) / 100,
            })),
          },
        }),
      },
      include: { allocations: true },
    })

    return apiCreated({ invoice })
  } catch (error) {
    return apiError('Fatura kaydedilirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar POST',
      error,
    })
  }
}
