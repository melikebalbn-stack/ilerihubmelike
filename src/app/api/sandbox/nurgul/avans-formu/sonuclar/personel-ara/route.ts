import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessSandbox } from '@/lib/sandbox-config'
import { prisma } from '@/lib/prisma'
import { isSandboxOwner } from '../../_lib/avans-formu-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET: İK'nin "listeye elle kişi ekle" arama kutusu için personel arama.
 * Ad-soyad veya sicil no substring (insensitive), sadece aktif personel,
 * en fazla 10 sonuç.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }
  if (user.role !== 'HR_MANAGER' && user.role !== 'SUPER_ADMIN' && !isSandboxOwner(user.email)) {
    return NextResponse.json({ error: 'Bu ekrana sadece İK erişebilir.' }, { status: 403 })
  }

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ sonuclar: [] })

  const sonuclar = await prisma.personnel.findMany({
    where: {
      aktif: true,
      OR: [
        { adSoyad: { contains: q, mode: 'insensitive' } },
        { sicilNo: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, adSoyad: true, bolum: true, sicilNo: true },
    take: 10,
  })

  return NextResponse.json({ sonuclar })
}
