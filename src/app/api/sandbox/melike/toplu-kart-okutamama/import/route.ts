import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

interface ImportRow {
  'SİCİL NO'?: string | number
  'ADI VE SOYADI'?: string
  'TARİH'?: string | number | Date
  'GİRİŞ SAATİ'?: string
  'ÇIKIŞ SAATİ'?: string
}

function parseExcelDate(value: string | number | Date | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  // "DD.MM.YYYY" veya "DD/MM/YYYY"
  const match = String(value).trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const fallback = new Date(value)
  return isNaN(fallback.getTime()) ? null : fallback
}

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/import
 * Excel dosyasından toplu kayıt oluşturur. Her satır SİCİL NO ile
 * Personnel (İV) tablosunda eşleştirilir — isim/sicil client'tan güvenilmez,
 * sadece gerçek Personnel kaydına bağlanan satırlar kabul edilir.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: ImportRow[] = XLSX.utils.sheet_to_json(sheet)

    const results: { created: number; errors: { row: number; message: string }[] } = {
      created: 0,
      errors: [],
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const sicilNo = row['SİCİL NO'] ? String(row['SİCİL NO']).trim() : ''
      const adSoyad = row['ADI VE SOYADI'] ? String(row['ADI VE SOYADI']).trim() : ''
      const tarih = parseExcelDate(row['TARİH'])

      if (!sicilNo && !adSoyad) {
        results.errors.push({ row: i + 2, message: 'Sicil No veya Ad Soyad boş' })
        continue
      }
      if (!tarih) {
        results.errors.push({ row: i + 2, message: 'Tarih okunamadı' })
        continue
      }

      const personnel = await prisma.personnel.findFirst({
        where: {
          aktif: true,
          ...(sicilNo
            ? { sicilNo }
            : { adSoyad: { equals: adSoyad, mode: 'insensitive' } }),
        },
        select: { id: true, sicilNo: true, adSoyad: true },
      })

      if (!personnel) {
        results.errors.push({
          row: i + 2,
          message: `Personel bulunamadı (Sicil No: ${sicilNo || '-'}, Ad Soyad: ${adSoyad || '-'})`,
        })
        continue
      }

      await prisma.bulkCardScanFailure.create({
        data: {
          personnelId: personnel.id,
          sicilNo: personnel.sicilNo,
          adSoyad: personnel.adSoyad,
          tarih,
          girisSaati: row['GİRİŞ SAATİ'] ? String(row['GİRİŞ SAATİ']).trim() : null,
          cikisSaati: row['ÇIKIŞ SAATİ'] ? String(row['ÇIKIŞ SAATİ']).trim() : null,
          createdById: user.id,
        },
      })
      results.created++
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Toplu kart okutamama import hatası:', error)
    return NextResponse.json({ error: 'Import başarısız' }, { status: 500 })
  }
}
