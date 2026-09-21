import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiBadRequest, apiForbidden, apiError } from '@/lib/api-response'
import { parseDepartmentCell, labelToCurrency, parseExcelDate, parseExcelAmount } from '../_lib/excel'
import { getRateForDate } from '../_lib/tcmb'
import { canAccessFaturaTakip } from '../_lib/access'
import { resolveDepartments } from '../_lib/invoice'

interface RowResult {
  row: number
  invoiceNumber?: string
  status: 'created' | 'skipped' | 'error'
  message?: string
}

// POST — multipart/form-data, field: file (.xlsx/.xls/.csv)
// Beklenen sütunlar: Tarih, Firma, Fatura No, Tutar, Para Birimi (ops., vars.TRY), Bölüm (ops., vars.Genel), Not (ops.)
// Bölüm hücresi çoklu bölüm formatını da kabul eder: "Kalite Müdürlüğü %60, Sistem Geliştirme Müdürlüğü %40"
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiBadRequest('Dosya bulunamadı')

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

    if (rows.length === 0) return apiBadRequest('Dosyada satır bulunamadı')
    if (rows.length > 500) return apiBadRequest('Tek seferde en fazla 500 satır yükleyebilirsin')

    const existingNumbers = new Set(
      (await prisma.invoice.findMany({ select: { invoiceNumber: true } })).map((i) => i.invoiceNumber)
    )
    const departments = await prisma.orgUnit.findMany({
      where: { unitType: 'DEPARTMENT', level: 3 },
      select: { id: true, name: true },
    })

    const results: RowResult[] = []
    let created = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // başlık satırı + 1-index

      const invoiceNumber = (row['Fatura No'] ?? row['FaturaNo'] ?? '').toString().trim()
      const companyName = (row['Firma'] ?? '').toString().trim()
      const dateStr = parseExcelDate(row['Tarih'])
      const amount = parseExcelAmount(row['Tutar'])
      const currency = labelToCurrency(row['Para Birimi'])
      const parsedDept = parseDepartmentCell(row['Bölüm'] ?? row['Kategori'], departments)
      const note = (row['Not'] ?? '').toString().trim() || null

      if (!invoiceNumber) {
        results.push({ row: rowNum, status: 'error', message: 'Fatura no boş' })
        continue
      }
      if (existingNumbers.has(invoiceNumber)) {
        results.push({ row: rowNum, invoiceNumber, status: 'skipped', message: 'Bu fatura no zaten kayıtlı' })
        continue
      }
      if (!companyName) {
        results.push({ row: rowNum, invoiceNumber, status: 'error', message: 'Firma adı boş' })
        continue
      }
      if (!dateStr) {
        results.push({ row: rowNum, invoiceNumber, status: 'error', message: 'Geçersiz/boş tarih' })
        continue
      }
      if (amount === null || amount <= 0) {
        results.push({ row: rowNum, invoiceNumber, status: 'error', message: 'Geçersiz/boş tutar' })
        continue
      }

      try {
        const resolved = await resolveDepartments(parsedDept.departmentOrgUnitId, parsedDept.allocations)
        if (typeof resolved === 'string') {
          results.push({ row: rowNum, invoiceNumber, status: 'error', message: resolved })
          continue
        }

        const tryRate = currency === 'TRY' ? 1 : (await getRateForDate(dateStr, currency)).rate
        const eurRate = currency === 'EUR' ? tryRate : (await getRateForDate(dateStr, 'EUR')).rate
        const amountTRY = currency === 'TRY' ? amount : amount * tryRate
        const amountEUR = currency === 'EUR' ? amount : amountTRY / eurRate

        await prisma.invoice.create({
          data: {
            invoiceDate: new Date(dateStr),
            companyName,
            invoiceNumber,
            amount,
            currency,
            exchangeRate: eurRate,
            amountTRY,
            amountEUR,
            departmentOrgUnitId: resolved.departmentOrgUnitId,
            departmentName: resolved.departmentName,
            note,
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
        })

        existingNumbers.add(invoiceNumber)
        created++
        results.push({ row: rowNum, invoiceNumber, status: 'created' })
      } catch (rowError) {
        results.push({
          row: rowNum,
          invoiceNumber,
          status: 'error',
          message: rowError instanceof Error ? rowError.message : 'Bilinmeyen hata',
        })
      }
    }

    return apiSuccess({
      total: rows.length,
      created,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errored: results.filter((r) => r.status === 'error').length,
      results,
    })
  } catch (error) {
    return apiError('Excel içe aktarılırken bir hata oluştu', 500, {
      endpoint: 'sandbox/melike/faturalar/import',
      error,
    })
  }
}
