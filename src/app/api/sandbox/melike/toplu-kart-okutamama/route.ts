import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from './_lib/access'
import { notifyHrOfBulkCardScanRecords, notifyApproverOfPendingRecord } from './_lib/notify-hr'
import { VALID_NEDEN } from './_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from './_lib/duplicate-check'
import { resolveApprovers, getManagedPersonnelIds } from './_lib/approvers'

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

function buildOrderBy(sortBy: string | null, sortOrder: string | null) {
  const order = sortOrder === 'asc' ? 'asc' : 'desc'
  const fieldShape = (sortBy && SORTABLE_FIELDS[sortBy]) || SORTABLE_FIELDS.tarih

  function applyOrder(shape: object): unknown {
    const [key] = Object.keys(shape)
    const value = (shape as Record<string, unknown>)[key]
    return { [key]: value === true ? order : applyOrder(value as object) }
  }

  return applyOrder(fieldShape)
}

/**
 * GET /api/sandbox/melike/toplu-kart-okutamama
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
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '25')))

    const where: Record<string, unknown> = {}

    if (ivDurum === 'onaylandi') where.ivOnaylandi = true
    else if (ivDurum === 'bekliyor') where.ivOnaylandi = false

    // Full (Eski Kayıtlar): onay BEKLIYOR durumundaki kayıtlar (kendi adına giriş
    // onay akışı) onaylanmadan burada görünmez. GRI/SELF kendi girdiği kayıtları
    // (kendi + ekibi, durumu ne olursa olsun) her zaman görebilir.
    if (access.level === 'FULL') {
      where.onayDurumu = { not: 'BEKLIYOR' }
    }

    if (access.level === 'GRI' || access.level === 'SELF') {
      // Kendi girdiği tüm kayıtlar: kendi adına + ekibi (Personel Yönetimi'nde
      // 1./2./3. Sorumlusu olduğu kişiler) için girdikleri — bölüm/arama
      // parametreleri göz ardı edilir.
      where.createdById = user.id
    } else if (bolum) {
      // Bölüm filtresi sadece FULL erişimde anlamlı.
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orderBy: buildOrderBy(sortBy, sortOrder) as any,
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

    // Onay akışı SADECE kişi KENDİ ADINA kayıt girdiğinde devreye girer (GRI
    // dahil, herkes için aynı kural) — ekibi için giriyorsa onay gerekmez,
    // direkt onaylı sayılır (Full'un başkası için girmesi gibi). Onaylayıcı
    // 1./2./3. Sorumlu'dan çözülür — üçünden biri onaylarsa/reddederse geçerli
    // olur, sıra yok. Hiçbiri çözülemezse kayıt kimseye atanmadan BEKLIYOR kalır.
    const isSelfEntry = (access.level === 'GRI' || access.level === 'SELF') && personnel.id === access.personnelId

    let onayDurumu: 'BEKLIYOR' | 'ONAYLANDI' = 'ONAYLANDI'
    let approverId: string | null = null
    let approverId2: string | null = null
    let approverId3: string | null = null
    if (isSelfEntry) {
      onayDurumu = 'BEKLIYOR'
      const resolved = await resolveApprovers(personnel.id)
      approverId = resolved.approverId
      approverId2 = resolved.approverId2
      approverId3 = resolved.approverId3
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
      notifyApproverOfPendingRecord(
        [record.approverId, record.approverId2, record.approverId3].filter((id): id is string => !!id),
        { sicilNo: record.sicilNo, adSoyad: record.adSoyad },
        user.name || user.email
      )
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Toplu kart okutamama oluşturma hatası:', error)
    return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
  }
}
