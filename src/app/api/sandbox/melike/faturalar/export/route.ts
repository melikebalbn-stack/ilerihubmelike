import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiForbidden, apiError } from '@/lib/api-response'
import { departmentLabel } from '../_lib/excel'
import { canAccessFaturaTakip } from '../_lib/access'
import { computeSummary } from '../_lib/summary'

// GET ?template=1 — boş şablon. ?type=summary — KPI'ya uygun bölüm kırılımı (sayısal, yuvarlanmamış).
// Aksi halde mevcut tüm faturalar (ham liste).
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const isTemplate = searchParams.get('template') === '1'
    const isSummary = searchParams.get('type') === 'summary'

    let rows: Record<string, string | number>[]
    let sheetName = 'Faturalar'
    let fileSuffix = 'Fatura_Takip'

    if (isSummary) {
      sheetName = 'KPI Özet'
      fileSuffix = 'Fatura_Takip_KPI_Ozet'

      const invoices = await prisma.invoice.findMany({
        select: {
          invoiceDate: true,
          amountEUR: true,
          amountTRY: true,
          departmentName: true,
          allocations: { select: { departmentName: true, amountEUR: true, amountTRY: true } },
        },
      })
      const revenueSetting = await prisma.invoiceRevenueSetting.findUnique({ where: { id: 'singleton' } })
      const totalCiro = revenueSetting ? Number(revenueSetting.totalRevenueEUR) : null

      const { departments } = computeSummary(invoices)

      rows = departments.map((d) => ({
        Bölüm: d.label,
        'Tutar (€)': d.eur,
        'Tutar (₺)': d.tl,
        'Ciro (€)': totalCiro ?? '',
        'Cironun Oranı (%)': totalCiro && totalCiro > 0 ? (d.eur / totalCiro) * 100 : '',
      }))
    } else if (isTemplate) {
      rows = [
        {
          Tarih: '2026-01-15',
          Firma: 'Örnek Firma A.Ş.',
          'Fatura No': 'ABC2026000000001',
          Tutar: 12500,
          'Para Birimi': 'TRY',
          'TL Karşılığı': '',
          '€ Karşılığı': '',
          Bölüm: 'Genel',
          Not: '',
        },
        {
          Tarih: '2026-01-16',
          Firma: 'Örnek Firma B Ltd.',
          'Fatura No': 'ABC2026000000002',
          Tutar: 8000,
          'Para Birimi': 'TRY',
          'TL Karşılığı': '',
          '€ Karşılığı': '',
          Bölüm: 'Kalite Müdürlüğü %60, Sistem Geliştirme Müdürlüğü %40',
          Not: 'Birden fazla bölüme bölünmüş fatura örneği — yüzdeler %100 etmeli',
        },
      ]
    } else {
      const invoices = await prisma.invoice.findMany({
        orderBy: { invoiceDate: 'desc' },
        include: { allocations: { orderBy: { percentage: 'desc' } } },
      })
      rows = invoices.map((inv) => ({
        Tarih: inv.invoiceDate.toISOString().slice(0, 10),
        Firma: inv.companyName,
        'Fatura No': inv.invoiceNumber,
        Tutar: Number(inv.amount),
        'Para Birimi': inv.currency,
        'TL Karşılığı': Number(inv.amountTRY),
        '€ Karşılığı': Number(inv.amountEUR),
        Bölüm:
          inv.allocations.length > 0
            ? inv.allocations.map((a) => `${a.departmentName} %${Number(a.percentage)}`).join(', ')
            : departmentLabel(inv.departmentName),
        Not: inv.note ?? '',
      }))
    }

    const sheet = XLSX.utils.json_to_sheet(rows)
    sheet['!cols'] = isSummary
      ? [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }]
      : [
          { wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
          { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
        ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, isTemplate ? 'Şablon' : sheetName)

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = isTemplate
      ? 'Fatura_Takip_Sablon.xlsx'
      : `${fileSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    return apiError('Excel oluşturulurken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/export',
      error,
    })
  }
}
