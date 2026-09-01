import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import {
  notifyHrOfBulkCardScanRecords,
  notifyApproverOfPendingRecord,
  notifyHrManagerOfUnresolvedApprover,
} from '../_lib/notify-hr'
import { VALID_NEDEN } from '../_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from '../_lib/duplicate-check'
import { onayKarariBelirle } from '../_lib/approvers'

export const dynamic = 'force-dynamic'

interface BulkItem {
  personnelId: string
  tarih: string
  girisSaati?: string
  cikisSaati?: string
  neden?: string
}

/**
 * POST /api/toplu-kart-okutamama/bulk
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
    // Toplu tarih/saat girme yetkisi sadece FULL'da (Süper Admin/İV) — GRI/SELF
    // tek tek kayıt açar, bu endpoint'i kullanamaz.
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
    // Kendi adına giren BEKLIYOR kayıtlar (onaylayıcıya bildirim için).
    const pendingSelf: {
      approverIds: string[]
      sicilNo: string | null
      adSoyad: string
      tarih: Date
    }[] = []

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
      // Not: bu endpoint FULL-only (yukarıda 403 ile kapılı); FULL kullanıcı bölüm
      // kısıtı olmadan tüm personele toplu kayıt açabilir — GRI kontrolü gereksiz.
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

      // KENDİ ADINA satır → FULL/İV dahil 1./2./3. Sorumlu onayına tabi (create/import
      // ile BİREBİR aynı kural; bulk yolundaki self-onay açığı kapatıldı). Diğer (gerçek
      // ekip) satırları FULL için onaysız (ONAYLANDI) kalır. resolveApprovers gönderen
      // kişiyi aday havuzundan dışlar (kendini-onaylama yok); hiçbiri çözülmezse orphan.
      // Karar create/import ile AYNI yardımcıdan — bu yol eskiden muafiyet
      // kontrolünü atlıyordu (muaf kişi bulk'ta BEKLIYOR, create'te ONAYLANDI).
      const { onayDurumu, approverId, approverId2, approverId3 } = await onayKarariBelirle(
        personnel.id,
        access.personnelId
      )

      await prisma.bulkCardScanFailure.create({
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
          approverId3,
        },
      })
      created++
      if (onayDurumu === 'ONAYLANDI') {
        createdSummaries.push({ sicilNo: personnel.sicilNo, adSoyad: personnel.adSoyad })
      } else {
        pendingSelf.push({
          approverIds: [approverId, approverId2, approverId3].filter((id): id is string => !!id),
          sicilNo: personnel.sicilNo,
          adSoyad: personnel.adSoyad,
          tarih: new Date(item.tarih),
        })
      }
    }

    // ONAYLANDI kayıtlar → İnsan Varlıkları'na in-app bildirim (mail yok).
    if (createdSummaries.length > 0) {
      notifyHrOfBulkCardScanRecords(createdSummaries, user.name || user.email)
    }
    // Kendi adına BEKLIYOR kayıt(lar) → 1./2./3. Sorumlu'ya onay bildirimi (create/import deseni).
    for (const p of pendingSelf) {
      if (p.approverIds.length > 0) {
        notifyApproverOfPendingRecord(p.approverIds, { sicilNo: p.sicilNo, adSoyad: p.adSoyad }, user.name || user.email)
      }
    }
    // Orphan: BEKLIYOR ama hiçbir onaycıya düşmeyen kayıtlar → İ.V. Müdürü (tek çağrı).
    const orphanlar = pendingSelf.filter((p) => p.approverIds.length === 0)
    if (orphanlar.length > 0) {
      notifyHrManagerOfUnresolvedApprover(orphanlar.map((p) => ({ adSoyad: p.adSoyad, tarih: p.tarih })))
    }

    return NextResponse.json({ created, errors })
  } catch (error) {
    console.error('Toplu kart okutamama toplu kayıt hatası:', error)
    return NextResponse.json({ error: 'Toplu kayıt oluşturulamadı' }, { status: 500 })
  }
}
