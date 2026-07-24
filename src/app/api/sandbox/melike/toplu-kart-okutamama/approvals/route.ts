import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sandbox/melike/toplu-kart-okutamama/approvals
 * Kendisine approver (1. Sorumlu) VEYA approver2 (2. Sorumlu) olarak atanmış,
 * henüz karara bağlanmamış kayıtları döner. Formun genel accessLevel'ından
 * BAĞIMSIZ — herhangi bir kullanıcı, birinin sorumlusuysa burada onun bekleyen
 * kayıtlarını görür.
 */
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const records = await prisma.bulkCardScanFailure.findMany({
      where: {
        onayDurumu: 'BEKLIYOR',
        OR: [{ approverId: user.id }, { approverId2: user.id }],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        personnel: { select: { id: true, bolum: true, gorev: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ records })
  } catch (error) {
    console.error('Toplu kart okutamama onay listesi hatası:', error)
    return NextResponse.json({ error: 'Onay listesi alınamadı' }, { status: 500 })
  }
}
