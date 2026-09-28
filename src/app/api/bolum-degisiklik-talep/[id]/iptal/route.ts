// Bölüm Değişikliği Talep Formu — talebi GERİ ÇEK (yalnız açan, yalnız BEKLIYOR).
// İV de geri çekebilir (kuyruğu temizlemek için); kararı olan talep dokunulmaz.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { bolumTalepYetkisiCore } from '@/lib/bolum-talep/bolum-talep-yetki'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    const yetki = await bolumTalepYetkisiCore(user.id, user.role, user.department)
    if (!yetki.erisebilir) {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const { id } = await params
    const talep = await prisma.bolumDegisiklikTalep.findUnique({
      where: { id },
      select: { id: true, talepNo: true, durum: true, acanUserId: true, personnelId: true, mevcutBolum: true, hedefBolum: true },
    })
    if (!talep) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 })
    if (!yetki.iv && talep.acanUserId !== user.id) {
      return NextResponse.json({ error: 'Yalnız kendi talebinizi geri çekebilirsiniz' }, { status: 403 })
    }
    if (talep.durum !== 'BEKLIYOR') {
      return NextResponse.json({ error: 'Karara bağlanmış talep geri çekilemez' }, { status: 409 })
    }

    const guncel = await prisma.$transaction(async (tx) => {
      const t = await tx.bolumDegisiklikTalep.update({
        where: { id },
        data: { durum: 'IPTAL', kararVerenId: user.id, kararTarihi: new Date() },
      })
      await tx.permissionAuditLog.create({
        data: {
          action: 'BOLUM_TALEP_IPTAL',
          actorId: user.id,
          targetType: 'PERSONNEL',
          targetId: talep.personnelId,
          details: {
            talepNo: talep.talepNo,
            talepId: talep.id,
            iptalEdenEmail: user.email,
            ivMi: yetki.iv,
            mevcutBolum: talep.mevcutBolum,
            hedefBolum: talep.hedefBolum,
          },
        },
      })
      return t
    })

    return NextResponse.json({ ok: true, talep: guncel })
  } catch (err) {
    console.error('Bölüm talep iptal hatası:', err)
    return NextResponse.json({ error: 'Talep geri çekilemedi' }, { status: 500 })
  }
}
