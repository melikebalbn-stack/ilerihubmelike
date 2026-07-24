import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { notifyHrOfBulkCardScanRecords, notifySubmitterOfDecision } from '../../_lib/notify-hr'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/[id]/decision
 * Onay/red — SELF akışında (Beyaz Yaka kendisi için giriş) kaydın approverId
 * VEYA approverId2'si (1. Sorumlu / 2. Sorumlu) olan kişi karar verir —
 * hangisi önce davranırsa geçerli olur, sıra yok. Bu yetki formun genel
 * accessLevel'ından BAĞIMSIZDIR: onaylayıcı kendisi formu kullanamıyor olsa
 * bile (örn. NONE) kendisine atanmış bekleyen kaydı onaylayıp reddedebilir.
 * Body: { decision: 'APPROVE' | 'REJECT' }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const decision = body?.decision
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return NextResponse.json({ error: 'decision APPROVE veya REJECT olmalıdır' }, { status: 400 })
    }

    const record = await prisma.bulkCardScanFailure.findUnique({
      where: { id },
      select: {
        id: true,
        approverId: true,
        approverId2: true,
        onayDurumu: true,
        sicilNo: true,
        adSoyad: true,
        tarih: true,
        createdById: true,
      },
    })
    if (!record) {
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    }

    if (record.approverId !== user.id && record.approverId2 !== user.id) {
      return NextResponse.json({ error: 'Bu kaydı onaylama/reddetme yetkiniz yok' }, { status: 403 })
    }

    if (record.onayDurumu !== 'BEKLIYOR') {
      return NextResponse.json({ error: 'Bu kayıt zaten karara bağlanmış' }, { status: 400 })
    }

    const updated = await prisma.bulkCardScanFailure.update({
      where: { id },
      data:
        decision === 'APPROVE'
          ? { onayDurumu: 'ONAYLANDI', approvedAt: new Date() }
          : { onayDurumu: 'REDDEDILDI', rejectedAt: new Date() },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
    })

    const approverName = user.name || user.email
    if (decision === 'APPROVE') {
      notifyHrOfBulkCardScanRecords([{ sicilNo: updated.sicilNo, adSoyad: updated.adSoyad }], updated.createdBy?.name || updated.createdBy?.email || approverName)
    }
    notifySubmitterOfDecision(
      record.createdById,
      new Date(record.tarih).toLocaleDateString('tr-TR'),
      decision,
      approverName
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Toplu kart okutamama onay/red hatası:', error)
    return NextResponse.json({ error: 'Karar işlenemedi' }, { status: 500 })
  }
}
