import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '../_lib/access'
import { scanDocumentsInRange, fetchInvoicePdf, pdfPathFor, type DiscoveredDocument } from '../_lib/elogo'
import { computeAmounts } from '../_lib/invoice'

// En az bu kadar farklı ayda faturası olan firma "düzenli gelen firma" sayılır.
const MIN_RECURRING_MONTHS = 3

function normalizeCompany(s: string): string {
  return s
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Çç]/g, 'c')
    .replace(/[Öö]/g, 'o')
    .replace(/[Üü]/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // noktalama (A.Ş. -> a s) temizlensin
    .replace(/\s+/g, ' ')
    .trim()
}

function companiesMatch(a: string, b: string): boolean {
  const na = normalizeCompany(a)
  const nb = normalizeCompany(b)
  return na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))
}

// Çalışan tarama durumu — tek admin kullanıcılı sandbox aracı için process-içi state yeterli,
// ayrı bir job tablosu gerekmiyor. Sunucu yeniden başlarsa durum sıfırlanır (tarama da durur).
interface ScanState {
  running: boolean
  startedAt: string | null
  fromDay: string | null
  toDay: string | null
  daysDone: number
  totalDays: number
  created: number
  companies: string[]
  error: string | null
}
const state: ScanState = {
  running: false,
  startedAt: null,
  fromDay: null,
  toDay: null,
  daysDone: 0,
  totalDays: 0,
  created: 0,
  companies: [],
  error: null,
}

// POST — düzenli gelen firmaların EN SON fatura tarihinden bugüne kadar eLogo'da tarama
// başlatır, bulduğu (DB'de henüz olmayan) faturaları otomatik ekler. Arka planda çalışır.
export async function POST() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    if (state.running) {
      return apiError('Zaten devam eden bir tarama var', 409, { endpoint: 'discover-invoices POST', error: null })
    }

    const rows = await prisma.invoice.groupBy({
      by: ['companyName'],
      _count: { _all: true },
    })
    // groupBy ay sayısını veremiyor — ayrı sorguyla farklı ay sayısını ve son tarihi/bölümü çekiyoruz.
    const companies: { companyName: string; lastDate: Date; departmentOrgUnitId: string | null; departmentName: string | null }[] = []
    for (const r of rows) {
      const invoicesForCompany = await prisma.invoice.findMany({
        where: { companyName: r.companyName },
        select: { invoiceDate: true, departmentOrgUnitId: true, departmentName: true },
        orderBy: { invoiceDate: 'desc' },
      })
      const distinctMonths = new Set(invoicesForCompany.map((i) => i.invoiceDate.toISOString().slice(0, 7)))
      if (distinctMonths.size >= MIN_RECURRING_MONTHS) {
        const last = invoicesForCompany[0]
        companies.push({
          companyName: r.companyName,
          lastDate: last.invoiceDate,
          departmentOrgUnitId: last.departmentOrgUnitId,
          departmentName: last.departmentName,
        })
      }
    }

    if (companies.length === 0) {
      return apiSuccess({ started: false, message: 'Düzenli gelen (3+ farklı ayda faturası olan) firma bulunamadı' })
    }

    const today = new Date().toISOString().slice(0, 10)
    const earliestLastDate = companies.reduce((min, c) => (c.lastDate < min ? c.lastDate : min), companies[0].lastDate)
    const fromDay = new Date(earliestLastDate)
    fromDay.setDate(fromDay.getDate() + 1)
    const fromDayStr = fromDay.toISOString().slice(0, 10)

    if (fromDayStr > today) {
      return apiSuccess({ started: false, message: 'Tüm düzenli firmaların zaten güncel' })
    }

    state.running = true
    state.startedAt = new Date().toISOString()
    state.fromDay = fromDayStr
    state.toDay = today
    state.daysDone = 0
    state.totalDays = 0
    state.created = 0
    state.companies = companies.map((c) => c.companyName)
    state.error = null

    void runDiscovery(companies, fromDayStr, today)

    return apiSuccess({
      started: true,
      companies: companies.map((c) => ({ companyName: c.companyName, lastDate: c.lastDate.toISOString().slice(0, 10) })),
      fromDay: fromDayStr,
      toDay: today,
    })
  } catch (error) {
    state.running = false
    return apiError('Otomatik fatura taraması başlatılırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/discover-invoices POST',
      error,
    })
  }
}

async function runDiscovery(
  companies: { companyName: string; lastDate: Date; departmentOrgUnitId: string | null; departmentName: string | null }[],
  fromDay: string,
  toDay: string
) {
  try {
    const allDocs = await scanDocumentsInRange(fromDay, toDay, (daysDone, totalDays) => {
      state.daysDone = daysDone
      state.totalDays = totalDays
    })

    for (const company of companies) {
      const matches = allDocs.filter(
        (d: DiscoveredDocument) => companiesMatch(d.supplierName, company.companyName) && d.issueDate > company.lastDate.toISOString().slice(0, 10)
      )

      for (const doc of matches) {
        try {
          const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: doc.invoiceNumber } })
          if (existing) continue

          const { exchangeRate, amountTRY, amountEUR } = await computeAmounts(
            doc.currency as 'TRY' | 'USD' | 'EUR',
            doc.amount,
            doc.issueDate
          )

          const invoice = await prisma.invoice.create({
            data: {
              invoiceDate: new Date(doc.issueDate),
              companyName: company.companyName,
              invoiceNumber: doc.invoiceNumber,
              amount: doc.amount,
              currency: doc.currency as 'TRY' | 'USD' | 'EUR',
              exchangeRate,
              amountTRY,
              amountEUR,
              departmentOrgUnitId: company.departmentOrgUnitId,
              departmentName: company.departmentName,
              note: 'eLogo\'dan otomatik eklendi (toplu tarama) — kontrol et',
              createdById: 'elogo-auto-scan',
              elogoUuid: doc.uuid,
              elogoCheckedAt: new Date(),
            },
          })

          try {
            const pdf = await fetchInvoicePdf(doc.uuid)
            const fs = await import('fs/promises')
            const pdfPath = await pdfPathFor(invoice.id)
            await fs.writeFile(pdfPath, pdf)
            await prisma.invoice.update({ where: { id: invoice.id }, data: { elogoPdfPath: pdfPath } })
          } catch {
            // PDF inmese de fatura kaydı zaten oluştu — "PDF indir" butonu sonra tekrar dener.
          }

          state.created++
        } catch (err) {
          console.error('[fatura-takip] discover-invoices fatura oluşturma hatası:', doc.invoiceNumber, err)
        }
      }
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
    console.error('[fatura-takip] discover-invoices tarama hatası:', err)
  } finally {
    state.running = false
  }
}

// GET — tarama ilerlemesi.
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    return apiSuccess(state)
  } catch (error) {
    return apiError('Durum alınırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/discover-invoices GET',
      error,
    })
  }
}
