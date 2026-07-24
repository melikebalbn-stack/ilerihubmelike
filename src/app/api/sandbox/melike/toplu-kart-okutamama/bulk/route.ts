import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { notifyHrOfBulkCardScanRecords, notifyApproverOfPendingRecord } from '../_lib/notify-hr'
import { VALID_NEDEN } from '../_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from '../_lib/duplicate-check'
import { resolveApprovers } from '../_lib/approvers'

export const dynamic = 'force-dynamic'

interface BulkItem {
  personnelId: string
  tarih: string
  girisSaati?: string
  cikisSaati?: string
  neden?: string
}

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/bulk
 * "Bana Bağlı Personel" panelinde tek tarih/saat girip tüm ekibe uygulama
 * (o günlük olmaması gereken kişi listeden çıkarıldıktan sonra kalanlar için
 * tek seferde kayıt oluşturur). Her personel ayrı ayrı doğrulanır (aktif mi) —
 * biri geçersizse diğerleri etkilenmez, hata olarak raporlanır.
 * Body: { items: { personnelId, tarih, girisSaati?, cikisSaati? }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    // Toplu tarih/saat girme yetkisi sadece FULL'da (Süper Admin/İV/Sistem
    // Geliştirme) — GRI tek tek kayıt açar, bu endpoint'i kullanamaz.
    if (access.level !== 'FULL') {
      return NextResponse.json({ error: 'Toplu kayıt girme yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const items: BulkItem[] = Array.isArray(body?.items) ? body.items : []

    if (items.length === 0) {
      return NextResponse.json({ error: 'Kayıt listesi boş' }, { status: 400 })
    }

    const personnelIds = [...new Set(items.map((i) => i.personnelId))]
    const personnelList = await prisma.personnel.findMany({
      where: { id: { in: personnelIds } },
      select: { id: true, sicilNo: true, adSoyad: true, aktif: true, bolum: true },
    })
    const personnelMap = new Map(personnelList.map((p) => [p.id, p]))

    let created = 0
    const errors: { personnelId: string; message: string }[] = []
    const createdSummaries: { sicilNo: string | null; adSoyad: string }[] = []

    for (const item of items) {
      const personnel = personnelMap.get(item.personnelId)
      if (!item.tarih) {
        errors.push({ personnelId: item.personnelId, message: 'Tarih eksik' })
        continue
      }
      if (!personnel || !personnel.aktif) {
        errors.push({ personnelId: item.personnelId, message: 'Personel bulunamadı veya pasif' })
        continue
      }
      if (item.neden && !(VALID_NEDEN as readonly string[]).includes(item.neden)) {
        errors.push({ personnelId: item.personnelId, message: 'Geçersiz neden' })
        continue
      }

      const isDuplicate = await hasDuplicateRecord({
        personnelId: personnel.id,
        tarih: new Date(item.tarih),
        girisSaati: item.girisSaati || null,
        cikisSaati: item.cikisSaati || null,
      })
      if (isDuplicate) {
        errors.push({ personnelId: item.personnelId, message: DUPLICATE_ERROR_MESSAGE })
        continue
      }

      let onayDurumu: 'BEKLIYOR' | 'ONAYLANDI' = 'ONAYLANDI'
      let approverId: string | null = null
      let approverId2: string | null = null
      if (access.selfApprovalRequired && personnel.id === access.personnelId) {
        const resolved = await resolveApprovers(personnel.id)
        if (resolved.approverId || resolved.approverId2) {
          onayDurumu = 'BEKLIYOR'
          approverId = resolved.approverId
          approverId2 = resolved.approverId2
        }
      }

      const record = await prisma.bulkCardScanFailure.create({
        data: {
          personnelId: personnel.id,
          sicilNo: personnel.sicilNo,
          adSoyad: personnel.adSoyad,
          tarih: new Date(item.tarih),
          girisSaati: item.girisSaati || null,
          cikisSaati: item.cikisSaati || null,
          neden: (item.neden as 'UNUTMA' | 'BOZULMA' | 'KAYBETME' | 'VAZIFE') || null,
          createdById: user.id,
          onayDurumu,
          approverId,
          approverId2,
        },
      })
      created++
      if (onayDurumu === 'ONAYLANDI') {
        createdSummaries.push({ sicilNo: personnel.sicilNo, adSoyad: personnel.adSoyad })
      } else {
        notifyApproverOfPendingRecord(
          [record.approverId, record.approverId2].filter((id): id is string => !!id),
          { sicilNo: record.sicilNo, adSoyad: record.adSoyad },
          user.name || user.email
        )
      }
    }

    // Fire-and-forget: İnsan Varlıkları'na in-app bildirim (mail yok) — sadece
    // direkt onaylı (BEKLIYOR olmayan) kayıtlar için.
    notifyHrOfBulkCardScanRecords(createdSummaries, user.name || user.email)

    return NextResponse.json({ created, errors })
  } catch (error) {
    console.error('Toplu kart okutamama toplu kayıt hatası:', error)
    return NextResponse.json({ error: 'Toplu kayıt oluşturulamadı' }, { status: 500 })
  }
}
