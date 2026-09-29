import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

/**
 * POST /api/toplu-kart-okutamama/iv-onay
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
    // ONAY KARARI — platform yöneticisi bypass'ı burada GEÇMEZ (29.09.2026):
    // kapsam bypassı görünürlük içindir, İV onayı gerçek İV yetkisi ister.
    if (access.level !== 'FULL' || access.platformBypass) {
      return NextResponse.json({ error: 'İV onayı verme yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Onaylanacak kayıt seçilmedi' }, { status: 400 })
    }

    const records = await prisma.bulkCardScanFailure.findMany({
      where: { id: { in: ids } },
      select: { id: true, ivOnaylandi: true, onayDurumu: true },
    })
    const recordMap = new Map(records.map((r) => [r.id, r]))

    // İV onayı AMİR kararından SONRA (28.09, İV): seçimde amir kararı ONAYLANDI olmayan kayıt varsa
    // HİÇBİRİ onaylanmaz → 409 + hangi kaydın neden engellendiği (kısmi İV onayı yok).
    const amirEngeli = ids
      .map((id) => recordMap.get(id))
      .filter((r): r is NonNullable<typeof r> => !!r && !r.ivOnaylandi && r.onayDurumu !== 'ONAYLANDI')
      .map((r) => ({
        id: r.id,
        message: r.onayDurumu === 'REDDEDILDI' ? 'Amir reddetti — İV onayı verilemez' : 'Amir onayı bekleniyor — İV onayı amir kararından sonra verilir',
      }))
    if (amirEngeli.length > 0) {
      return NextResponse.json(
        { error: `${amirEngeli.length} kayıtta amir kararı yok ya da red — İV onayı amir onayından sonra verilir; hiçbir kayıt onaylanmadı`, errors: amirEngeli },
        { status: 409 },
      )
    }

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
