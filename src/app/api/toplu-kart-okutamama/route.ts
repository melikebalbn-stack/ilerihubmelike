import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from './_lib/access'
import {
  notifyHrOfBulkCardScanRecords,
  notifyApproverOfPendingRecord,
  notifyHrManagerOfUnresolvedApprover,
} from './_lib/notify-hr'
import { VALID_NEDEN } from './_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from './_lib/duplicate-check'
import { onayKarariBelirle, getManagedPersonnelIds } from './_lib/approvers'

export const dynamic = 'force-dynamic'

// Sıralanabilir kolonlar — client'tan gelen sortBy bunlardan biri değilse tarih'e düşülür.
const SORTABLE_FIELDS: Record<string, object> = {
  tarih: { tarih: true },
  sicilNo: { sicilNo: true },
  adSoyad: { adSoyad: true },
  girisSaati: { girisSaati: true },
  cikisSaati: { cikisSaati: true },
  neden: { neden: true },
  onayDurumu: { onayDurumu: true },
  ivOnaylandi: { ivOnaylandi: true },
  bolum: { personnel: { bolum: true } },
  olusturan: { createdBy: { name: true } },
}

function buildOrderBy(
  sortBy: string | null,
  sortOrder: string | null,
): Prisma.BulkCardScanFailureOrderByWithRelationInput {
  const order = sortOrder === 'asc' ? 'asc' : 'desc'
  const fieldShape = (sortBy && SORTABLE_FIELDS[sortBy]) || SORTABLE_FIELDS.tarih

  function applyOrder(shape: object): Record<string, unknown> {
    const [key] = Object.keys(shape)
    const value = (shape as Record<string, unknown>)[key]
    return { [key]: value === true ? order : applyOrder(value as object) }
  }

  return applyOrder(fieldShape) as Prisma.BulkCardScanFailureOrderByWithRelationInput
}

/**
 * GET /api/toplu-kart-okutamama
 * Liste — FULL (Beyaz Yaka) tüm kayıtları görür, GRI kendi bölümündeki
 * (Personnel.bolum) personele ait kayıtları görür, NONE (Mavi Yaka) erişemez.
 * Query params: search (sicilNo/adSoyad), startDate, endDate, page, limit,
 * sortBy (tarih|sicilNo|adSoyad|girisSaati|cikisSaati|neden|onayDurumu|ivOnaylandi|bolum|olusturan),
 * sortOrder (asc|desc)
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
    const ivDurum = searchParams.get('ivDurum') // 'onaylandi' | 'bekliyor'
    // Kapsam SUNUCUDA zorlanır: kendi → yalnız kendi personnelId kayıtları (HERKES,
    // FULL dahil); ekip → mevcut erişim kapsamı. Client kapsamı GENİŞLETEMEZ.
    const kapsam = searchParams.get('kapsam') === 'kendi' ? 'kendi' : 'ekip'
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Record<string, unknown> = {}

    if (ivDurum === 'onaylandi') where.ivOnaylandi = true
    else if (ivDurum === 'bekliyor') where.ivOnaylandi = false

    if (kapsam === 'kendi') {
      // "Geçmiş Kayıtlarım": YALNIZ kişinin KENDİ kayıtları (personnelId = kendisi),
      // erişim seviyesinden bağımsız (FULL dahil). Tüm statüler (kendi BEKLIYOR dahil).
      where.personnelId = access.personnelId ?? '__none__'
    } else {
      // ekip: mevcut erişim kapsamı.
      // Full (Eski Kayıtlar): BEKLIYOR kayıtlar burada görünmez — İSTİSNA: 1./2./3.
      // Sorumlu'nun ÜÇÜ DE null olan "sorumsuz" BEKLIYOR (İV kararı için) görünür.
      if (access.level === 'FULL') {
        where.OR = [
          { onayDurumu: { not: 'BEKLIYOR' } },
          { onayDurumu: 'BEKLIYOR', approverId: null, approverId2: null, approverId3: null },
        ]
      }

      if (access.level === 'GRI' || access.level === 'SELF') {
        // Kendi girdiği tüm kayıtlar: kendi adına + ekibi (sorumlusu olduğu kişiler).
        where.createdById = user.id
      } else if (bolum) {
        // Bölüm filtresi sadece FULL erişimde anlamlı.
        where.personnel = { bolum }
      }
    }

    if (search) {
      const searchOr = [
        { adSoyad: { contains: search, mode: 'insensitive' } },
        { sicilNo: { contains: search, mode: 'insensitive' } },
      ]
      if (Array.isArray(where.OR)) {
        // FULL durum-OR'u zaten kurulu → durum VE arama olacak şekilde AND ile birleştir
        // (aksi halde arama OR'u durum filtresini ezerdi).
        where.AND = [{ OR: where.OR }, { OR: searchOr }]
        delete where.OR
      } else {
        where.OR = searchOr
      }
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
        orderBy: buildOrderBy(sortBy, sortOrder),
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
    const { personnelId, tarih, girisSaati, cikisSaati, neden } = body

    if (!personnelId || !tarih) {
      return NextResponse.json({ error: 'personnelId ve tarih zorunludur' }, { status: 400 })
    }

    if (neden && !(VALID_NEDEN as readonly string[]).includes(neden)) {
      return NextResponse.json({ error: 'Geçersiz neden' }, { status: 400 })
    }

    // GRI/SELF: kendi adına, ya da (varsa) 1./2./3. Sorumlusu olduğu kişiler
    // için kayıt açabilir — başkası için açamaz. Full'da kısıtlama yok.
    if ((access.level === 'GRI' || access.level === 'SELF') && personnelId !== access.personnelId) {
      const managedIds = access.personnelId ? await getManagedPersonnelIds(access.personnelId) : []
      if (!managedIds.includes(personnelId)) {
        return NextResponse.json({ error: 'Sadece kendi adınıza veya ekibiniz için kayıt girebilirsiniz' }, { status: 403 })
      }
    }

    // Sicil No / Ad Soyad her zaman Personnel (İV) kaydından alınır — client'tan
    // gelen isim/sicil değeri güvenilmez, sadece seçim (personnelId) kabul edilir.
    const personnel = await prisma.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true },
    })

    if (!personnel || !personnel.aktif) {
      return NextResponse.json({ error: 'Seçilen personel bulunamadı veya pasif' }, { status: 400 })
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

    // Onay akışı SADECE kişi KENDİ ADINA kayıt girdiğinde devreye girer. Kendi adına
    // giren HERKES (FULL/İV/Super Admin dahil) 1./2./3. Sorumlu onayına tabidir —
    // rol onayı ATLATMAZ (Melih kararı). Level kısıtı KALDIRILDI: yalnız "bu kayıt
    // benim mi" (personnel.id === access.personnelId) belirleyici. Başkası için giriş
    // (Full veya ekip/managed) DEĞİŞMEDİ — line 175 managed kapısından geçer, onaysız
    // (ONAYLANDI) doğar. Onaylayıcı 1./2./3. Sorumlu'dan çözülür — biri onaylar/reddederse
    // geçerli, sıra yok. Hiçbiri çözülemezse kayıt kimseye atanmadan BEKLIYOR kalır (orphan).
    // Onay durumu + onaycılar TEK KAYNAK: onayKarariBelirle (create/bulk/import
    // aynı yardımcıyı çağırır). MUAFİYET (2026-08) kuralı da orada.
    const { onayDurumu, approverId, approverId2, approverId3 } = await onayKarariBelirle(
      personnel.id,
      access.personnelId
    )

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
        approverId2,
        approverId3,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
    })

    if (record.onayDurumu === 'ONAYLANDI') {
      // Fire-and-forget: İnsan Varlıkları'na in-app bildirim (mail yok)
      notifyHrOfBulkCardScanRecords([{ sicilNo: record.sicilNo, adSoyad: record.adSoyad }], user.name || user.email)
    } else {
      const onaycilar = [record.approverId, record.approverId2, record.approverId3].filter(
        (id): id is string => !!id
      )
      if (onaycilar.length > 0) {
        notifyApproverOfPendingRecord(
          onaycilar,
          { sicilNo: record.sicilNo, adSoyad: record.adSoyad },
          user.name || user.email
        )
      } else {
        // Orphan: BEKLIYOR ama kimseye düşmedi → İ.V. Müdürü haberdar edilir.
        notifyHrManagerOfUnresolvedApprover([{ adSoyad: record.adSoyad, tarih: record.tarih }])
      }
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Toplu kart okutamama oluşturma hatası:', error)
    return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
  }
}
