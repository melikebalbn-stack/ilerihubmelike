import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiForbidden, apiError } from '@/lib/api-response'
import { departmentLabel } from '../_lib/excel'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'

// GET ?template=1 — boş şablon (başlıklar + 1 örnek satır); aksi halde mevcut tüm faturalar
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { searchParams } = new URL(request.url)
    const isTemplate = searchParams.get('template') === '1'

    let rows: Record<string, string | number>[]

    if (isTemplate) {
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
      ]
    } else {
      const invoices = await prisma.invoice.findMany({ orderBy: { invoiceDate: 'desc' } })
      rows = invoices.map((inv) => ({
        Tarih: inv.invoiceDate.toISOString().slice(0, 10),
        Firma: inv.companyName,
        'Fatura No': inv.invoiceNumber,
        Tutar: Number(inv.amount),
        'Para Birimi': inv.currency,
        'TL Karşılığı': Number(inv.amountTRY),
        '€ Karşılığı': Number(inv.amountEUR),
        Bölüm: departmentLabel(inv.departmentName),
        Not: inv.note ?? '',
      }))
    }

    const sheet = XLSX.utils.json_to_sheet(rows)
    sheet['!cols'] = [
      { wch: 12 }, { wch: 32 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, isTemplate ? 'Şablon' : 'Faturalar')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
    const fileName = isTemplate
      ? 'Fatura_Takip_Sablon.xlsx'
      : `Fatura_Takip_${new Date().toISOString().slice(0, 10)}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    return apiError('Excel oluşturulurken bir hata oluştu', 500, {
      endpoint: 'finans/faturalar/export',
      error,
    })
  }
}
