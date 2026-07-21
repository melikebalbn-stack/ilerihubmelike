import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from './_lib/access'

export const dynamic = 'force-dynamic'

/**
 * GET /api/toplu-kart-okutamama
 * Liste — FULL (Beyaz Yaka) tüm kayıtları görür, GRI kendi bölümündeki
 * (Personnel.bolum) personele ait kayıtları görür, NONE (Mavi Yaka) erişemez.
 * Query params: search (sicilNo/adSoyad), startDate, endDate, page, limit
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Record<string, unknown> = {}

    if (access.level === 'GRI') {
      where.personnel = { bolum: access.bolum }
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

    const [records, total] = await Promise.all([
      prisma.bulkCardScanFailure.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          personnel: { select: { id: true, bolum: true, gorev: true } },
        },
        orderBy: { tarih: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bulkCardScanFailure.count({ where }),
    ])

    return NextResponse.json({
      records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      accessLevel: access.level,
    })
  } catch (error) {
    console.error('Toplu kart okutamama liste hatası:', error)
    return NextResponse.json({ error: 'Kayıtlar alınamadı' }, { status: 500 })
  }
}

/**
 * POST /api/toplu-kart-okutamama
 * Yeni kayıt oluştur — FULL veya GRI oluşturabilir, NONE oluşturamaz.
 * Body: { personnelId, tarih, girisSaati?, cikisSaati? }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { personnelId, tarih, girisSaati, cikisSaati } = body

    if (!personnelId || !tarih) {
      return NextResponse.json({ error: 'personnelId ve tarih zorunludur' }, { status: 400 })
    }

    // Sicil No / Ad Soyad her zaman Personnel (İV) kaydından alınır — client'tan
    // gelen isim/sicil değeri güvenilmez, sadece seçim (personnelId) kabul edilir.
    const personnel = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true },
    })

    if (!personnel || !personnel.aktif) {
      return NextResponse.json({ error: 'Seçilen personel bulunamadı veya pasif' }, { status: 400 })
    }

    if (access.level === 'GRI' && personnel.bolum !== access.bolum) {
      return NextResponse.json({ error: 'Sadece kendi bölümünüzdeki personel için kayıt açabilirsiniz' }, { status: 403 })
    }

    const record = await prisma.bulkCardScanFailure.create({
      data: {
        personnelId: personnel.id,
        sicilNo: personnel.sicilNo,
        adSoyad: personnel.adSoyad,
        tarih: new Date(tarih),
        girisSaati: girisSaati || null,
        cikisSaati: cikisSaati || null,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Toplu kart okutamama oluşturma hatası:', error)
    return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
  }
}
