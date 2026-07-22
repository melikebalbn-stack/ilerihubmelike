import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from './_lib/access'
import { notifyHrOfBulkCardScanRecords, notifyApproverOfPendingRecord } from './_lib/notify-hr'
import { VALID_NEDEN } from './_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from './_lib/duplicate-check'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sandbox/melike/toplu-kart-okutamama
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
    const bolum = searchParams.get('bolum')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Record<string, unknown> = {}

    if (access.level === 'GRI') {
      where.personnel = { bolum: access.bolum }
    } else if (access.level === 'SELF') {
      // SELF sadece kendi kayıtlarını görebilir — bölüm/arama parametreleri göz ardı edilir.
      where.personnelId = access.personnelId ?? '__none__'
    } else if (bolum) {
      // Bölüm filtresi sadece FULL erişimde anlamlı — GRI zaten kendi bölümüne kilitli.
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
      bolum: access.bolum,
    })
  } catch (error) {
    console.error('Toplu kart okutamama liste hatası:', error)
    return NextResponse.json({ error: 'Kayıtlar alınamadı' }, { status: 500 })
  }
}

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama
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
    const { personnelId, tarih, girisSaati, cikisSaati, neden } = body

    if (!personnelId || !tarih) {
      return NextResponse.json({ error: 'personnelId ve tarih zorunludur' }, { status: 400 })
    }

    if (neden && !(VALID_NEDEN as readonly string[]).includes(neden)) {
      return NextResponse.json({ error: 'Geçersiz neden' }, { status: 400 })
    }

    // SELF (Beyaz Yaka, kendisi için giriş) sadece kendi personnelId'si için kayıt açabilir.
    if (access.level === 'SELF' && personnelId !== access.personnelId) {
      return NextResponse.json({ error: 'Sadece kendi adınıza kayıt girebilirsiniz' }, { status: 403 })
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

    const isDuplicate = await hasDuplicateRecord({
      personnelId: personnel.id,
      tarih: new Date(tarih),
      girisSaati: girisSaati || null,
      cikisSaati: cikisSaati || null,
    })
    if (isDuplicate) {
      return NextResponse.json({ error: DUPLICATE_ERROR_MESSAGE }, { status: 409 })
    }

    // SELF akışı her zaman, FULL akışı ise sadece selfApprovalRequired olan bir
    // bölümdeyken (örn. Sistem Geliştirme) VE kendi adına giriyorsa müdür onayından
    // geçer. Müdürü yoksa (managerId null) onay adımı atlanır, kayıt direkt onaylı sayılır.
    const requiresSelfApproval =
      access.level === 'SELF' || (access.selfApprovalRequired && personnel.id === access.personnelId)

    let onayDurumu: 'BEKLIYOR' | 'ONAYLANDI' = 'ONAYLANDI'
    let approverId: string | null = null
    if (requiresSelfApproval) {
      const requester = await prisma.user.findUnique({ where: { id: user.id }, select: { managerId: true } })
      if (requester?.managerId) {
        onayDurumu = 'BEKLIYOR'
        approverId = requester.managerId
      }
    }

    const record = await prisma.bulkCardScanFailure.create({
      data: {
        personnelId: personnel.id,
        sicilNo: personnel.sicilNo,
        adSoyad: personnel.adSoyad,
        tarih: new Date(tarih),
        girisSaati: girisSaati || null,
        cikisSaati: cikisSaati || null,
        neden: neden || null,
        createdById: user.id,
        onayDurumu,
        approverId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
    })

    if (record.onayDurumu === 'ONAYLANDI') {
      // Fire-and-forget: İnsan Varlıkları'na in-app bildirim (mail yok)
      notifyHrOfBulkCardScanRecords([{ sicilNo: record.sicilNo, adSoyad: record.adSoyad }], user.name || user.email)
    } else if (record.approverId) {
      notifyApproverOfPendingRecord(record.approverId, { sicilNo: record.sicilNo, adSoyad: record.adSoyad }, user.name || user.email)
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Toplu kart okutamama oluşturma hatası:', error)
    return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
  }
}
