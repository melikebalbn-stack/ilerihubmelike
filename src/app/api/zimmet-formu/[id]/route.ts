import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params

    const zimmet = await prisma.zimmetFormu.findUnique({
      where: { id },
      include: {
        zimmetSahibi: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
        onaylayan: { select: { name: true, email: true } },
      },
    })

    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    // Sahip kendi kaydını, zimmet-formu.view yetkilisi hepsini görebilir.
    const yetkili =
      zimmet.zimmetSahibiId === user.id || (await hasPermission('zimmet-formu.view'))
    if (!yetkili) {
      return NextResponse.json({ error: 'Bu kaydı görüntüleme yetkiniz yok' }, { status: 403 })
    }

    return NextResponse.json(zimmet)
  } catch (err) {
    console.error('[GET /api/zimmet-formu/[id]]', err)
    return NextResponse.json({ error: 'Zimmet formu yüklenemedi' }, { status: 500 })
  }
}
