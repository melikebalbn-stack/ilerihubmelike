import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/admin/personnel-ad-reconcile/auto-bind-bluecollar
 *
 * Bluecollar email lokali ↔ Personnel.sicilNo "ILR-<lokali>" exact match.
 * Tüm uygun eşleşmeleri tek transaction'da bind eder.
 *
 * Audit: her bind için USER_PERSONNEL_AUTO_LINKED kaydı.
 */
export async function POST() {
  const { session, user, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.users.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  // Bağlanmamış bluecollar user'ları bul
  const bluecollarUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      personnelId: null,
      email: { endsWith: '@bluecollar.ilerigroup.com' },
    },
    select: { id: true, email: true, name: true },
  })

  if (bluecollarUsers.length === 0) {
    return NextResponse.json({ bound: 0, skipped: 0, results: [] })
  }

  // Aday sicilNo listesi
  const candidates = bluecollarUsers.map((u) => ({
    user: u,
    sicilNo: `ILR-${u.email.split('@')[0]}`,
  }))

  // İlgili Personnel'leri toplu çek (sadece henüz user'ı olmayanlar)
  const personnels = await prisma.personnel.findMany({
    where: {
      sicilNo: { in: candidates.map((c) => c.sicilNo) },
      user: null,
    },
    select: { id: true, sicilNo: true, adSoyad: true },
  })
  const bySicilNo = new Map(personnels.map((p) => [p.sicilNo, p]))

  const results: Array<{
    userId: string
    userEmail: string
    bound: boolean
    reason?: string
    personnelSicilNo?: string | null
    personnelName?: string
  }> = []

  await prisma.$transaction(async (tx) => {
    for (const c of candidates) {
      const p = bySicilNo.get(c.sicilNo)
      if (!p) {
        results.push({
          userId: c.user.id,
          userEmail: c.user.email,
          bound: false,
          reason: `Personnel ${c.sicilNo} bulunamadı veya başka kullanıcıya bağlı`,
        })
        continue
      }
      await tx.user.update({
        where: { id: c.user.id },
        data: { personnelId: p.id },
      })
      await tx.permissionAuditLog.create({
        data: {
          action: 'USER_PERSONNEL_AUTO_LINKED',
          actorId: user.id,
          targetType: 'USER',
          targetId: c.user.id,
          details: {
            actorEmail: user.email,
            targetUserEmail: c.user.email,
            targetUserName: c.user.name,
            personnelId: p.id,
            personnelSicilNo: p.sicilNo,
            personnelName: p.adSoyad,
            method: 'bluecollar_sicilno_exact_match',
          },
        },
      })
      results.push({
        userId: c.user.id,
        userEmail: c.user.email,
        bound: true,
        personnelSicilNo: p.sicilNo,
        personnelName: p.adSoyad,
      })
    }
  })

  const bound = results.filter((r) => r.bound).length
  const skipped = results.length - bound
  return NextResponse.json({ bound, skipped, results })
}
