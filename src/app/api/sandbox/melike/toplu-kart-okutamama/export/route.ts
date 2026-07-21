import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { NEDEN_LABELS, type KartOkutamamaNedeni } from '../_lib/neden'

export const dynamic = 'force-dynamic'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('tr-TR')
}

/**
 * GET /api/sandbox/melike/toplu-kart-okutamama/export
 * FULL (Beyaz Yaka) tüm kayıtları, GRI sadece kendi oluşturduklarını export eder.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const bolum = searchParams.get('bolum')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Record<string, unknown> = {}
    if (access.level === 'GRI') {
      where.createdById = user.id
    } else if (bolum) {
      where.personnel = { bolum }
    }
    if (search) {
      where.OR = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (startDate || endDate) {
      where.tarih = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const records = await prisma.bulkCardScanFailure.findMany({
      where,
      include: { personnel: { select: { bolum: true } } },
      orderBy: { tarih: 'desc' },
    })

    const headers = ['SİCİL NO', 'ADI VE SOYADI', 'BÖLÜM', 'TARİH', 'GİRİŞ SAATİ', 'ÇIKIŞ SAATİ', 'NEDEN']
    const data = records.map((r) => ({
      'SİCİL NO': r.sicilNo || '',
      'ADI VE SOYADI': r.adSoyad,
      'BÖLÜM': r.personnel?.bolum || '',
      'TARİH': formatDate(r.tarih),
      'GİRİŞ SAATİ': r.girisSaati || '',
      'ÇIKIŞ SAATİ': r.cikisSaati || '',
      'NEDEN': r.neden ? NEDEN_LABELS[r.neden as KartOkutamamaNedeni] : '',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers })
    worksheet['!cols'] = headers.map((key) => ({ wch: Math.max(key.length + 2, 15) }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Toplu Kart Okutamama')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="toplu_kart_okutamama_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Toplu kart okutamama export hatası:', error)
    return NextResponse.json({ error: 'Export alınamadı' }, { status: 500 })
  }
}
