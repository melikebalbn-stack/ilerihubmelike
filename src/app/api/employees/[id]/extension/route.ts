import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT /api/employees/[id]/extension - 3CX dahili numarasını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // PR-Y7a: enum check yerine RBAC permission. Y3c matrisinde calisanrehberi.admin
    // hr-yoneticisi + super-admin'de. Eski ADMIN enum kullanıcıları artık 403
    // (3CX dahili yönetimi HR Yöneticisi'nin işi, genel admin değil).
    if (!session.user.permissions?.includes('calisanrehberi.admin')) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { extension3cx } = body

    // Kullanıcıyı bul (ad_username formatı veya email ile)
    let user = await prisma.user.findUnique({
      where: { id: `ad_${id}` },
      select: { id: true },
    })

    if (!user) {
      // Email ile dene
      user = await prisma.user.findFirst({
        where: { email: { contains: id, mode: 'insensitive' } },
        select: { id: true },
      })
    }

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { extension3cx: extension3cx || null },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Extension güncelleme hatası:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
