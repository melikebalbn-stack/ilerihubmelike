import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'

export const dynamic = 'force-dynamic'

/**
 * GET: FULL erişim (Süper Admin/İV/Sistem Geliştirme) için bölüm listesi —
 * Eski Kayıtlar filtresinde ve "Bölüme Göre Ekle" seçiminde kullanılır.
 */
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level !== 'FULL') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const rows = await prisma.personnel.findMany({
      where: { aktif: true },
      distinct: ['bolum'],
      select: { bolum: true },
      orderBy: { bolum: 'asc' },
    })

    return NextResponse.json(rows.map((r) => r.bolum).filter(Boolean))
  } catch (error) {
    console.error('Toplu kart okutamama bölüm listesi hatası:', error)
    return NextResponse.json({ error: 'Bölüm listesi alınamadı' }, { status: 500 })
  }
}
