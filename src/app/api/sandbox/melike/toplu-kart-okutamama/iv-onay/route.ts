import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/iv-onay
 * İV onayı — müdür onayından tamamen ayrı, ek bir katman. Sadece FULL erişim
 * (Süper Admin/İV/Sistem Geliştirme) kullanabilir. Tekli ve toplu onay için
 * aynı endpoint: body her zaman ids dizisi taşır.
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level !== 'FULL') {
      return NextResponse.json({ error: 'İV onayı verme yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Onaylanacak kayıt seçilmedi' }, { status: 400 })
    }

    const records = await prisma.bulkCardScanFailure.findMany({
      where: { id: { in: ids } },
      select: { id: true, ivOnaylandi: true },
    })
    const recordMap = new Map(records.map((r) => [r.id, r]))

    let approved = 0
    const errors: { id: string; message: string }[] = []
    const toApprove: string[] = []

    for (const id of ids) {
      const record = recordMap.get(id)
      if (!record) {
        errors.push({ id, message: 'Kayıt bulunamadı' })
        continue
      }
      if (record.ivOnaylandi) {
        errors.push({ id, message: 'Bu kayıt zaten İV onaylı' })
        continue
      }
      toApprove.push(id)
    }

    if (toApprove.length > 0) {
      const result = await prisma.bulkCardScanFailure.updateMany({
        where: { id: { in: toApprove } },
        data: {
          ivOnaylandi: true,
          ivOnaylayanId: user.id,
          ivOnaylandiAt: new Date(),
        },
      })
      approved = result.count
    }

    return NextResponse.json({ approved, errors })
  } catch (error) {
    console.error('Toplu kart okutamama İV onay hatası:', error)
    return NextResponse.json({ error: 'İV onayı işlenemedi' }, { status: 500 })
  }
}
