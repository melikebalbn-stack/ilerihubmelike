import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Anketi kapat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // PR-AUTHUTILS-CLEAN: duyuru.admin (admin) || duyuru.create (HR yöneticisi anketi kapatabilir)
    const perms = session.user.permissions
    const isAdmin = (perms?.includes('duyuru.admin') || perms?.includes('duyuru.create')) ?? false

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const survey = await prisma.survey.findUnique({
      where: { id }
    })

    if (!survey) {
      return NextResponse.json({ error: 'Anket bulunamadi' }, { status: 404 })
    }

    if (survey.status === 'CLOSED') {
      return NextResponse.json({ error: 'Anket zaten kapali' }, { status: 400 })
    }

    const updated = await prisma.survey.update({
      where: { id },
      data: { status: 'CLOSED' }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Survey close error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
