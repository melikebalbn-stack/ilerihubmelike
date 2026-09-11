import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { InvoiceCategory, InvoiceCurrency, Prisma } from '@/generated/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiCreated, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { getRateForDate } from './_lib/tcmb'
import { canAccessFaturaTakip } from './_lib/access'

const CATEGORIES: InvoiceCategory[] = ['GENEL', 'SISTEM_GELISTIRME']
const CURRENCIES: InvoiceCurrency[] = ['TRY', 'USD', 'EUR']

// GET ?category=&search= — fatura listesi
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim()

    const where: Prisma.InvoiceWhereInput = {}
    if (category && CATEGORIES.includes(category as InvoiceCategory)) {
      where.category = category as InvoiceCategory
    }
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const invoices = await prisma.invoice.findMany({
      where,
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
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const body = await request.json()
    const { invoiceDate, companyName, invoiceNumber, amount, currency, category, note } = body

    if (!invoiceDate) return apiBadRequest('Fatura tarihi gerekli')
    if (!companyName?.trim()) return apiBadRequest('Firma adı gerekli')
    if (!invoiceNumber?.trim()) return apiBadRequest('Fatura no gerekli')
    const amountNum = Number(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) return apiBadRequest('Geçerli bir tutar gir')
    if (!CURRENCIES.includes(currency)) return apiBadRequest('Geçersiz para birimi')
    if (!CATEGORIES.includes(category)) return apiBadRequest('Geçersiz kategori')

    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: invoiceNumber.trim() } })
    if (existing) return apiBadRequest('Bu fatura no zaten kayıtlı')

    const date = new Date(invoiceDate)
    if (isNaN(date.getTime())) return apiBadRequest('Geçersiz tarih')

    const dateStr = invoiceDate.slice(0, 10)

    // Girilen para biriminin TRY karşılığı için kur
    const tryRate = currency === 'TRY' ? 1 : (await getRateForDate(dateStr, currency)).rate
    // TRY -> EUR dönüşümü için EUR kuru (girilen para birimi zaten EUR ise aynısı)
    const eurRate = currency === 'EUR' ? tryRate : (await getRateForDate(dateStr, 'EUR')).rate

    const amountTRY = currency === 'TRY' ? amountNum : amountNum * tryRate
    const amountEUR = currency === 'EUR' ? amountNum : amountTRY / eurRate

    const invoice = await prisma.invoice.create({
      data: {
        invoiceDate: date,
        companyName: companyName.trim(),
        invoiceNumber: invoiceNumber.trim(),
        amount: amountNum,
        currency,
        exchangeRate: eurRate,
        amountTRY,
        amountEUR,
        category,
        note: note?.trim() || null,
        createdById: user.id,
      },
    })

    return apiCreated({ invoice })
  } catch (error) {
    return apiError('Fatura kaydedilirken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar POST',
      error,
    })
  }
}
