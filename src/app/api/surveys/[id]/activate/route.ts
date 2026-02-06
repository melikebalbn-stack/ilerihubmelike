import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin as checkIsAdmin, hasRole } from '@/lib/auth-utils'

// POST - Anketi aktif et
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
    const userEmail = String(session.user.email).toLowerCase()
    const userRole = session.user.role || 'EMPLOYEE'

    // FIX #4: Merkezi utility kullanıldı
    const isAdmin = checkIsAdmin(userEmail, userRole) || hasRole(userRole, ['HR_MANAGER', 'IT_MANAGER'])

    if (!isAdmin) {
      return NextResponse.json({ error: 'Bu islem icin yetkiniz yok' }, { status: 403 })
    }

    const survey = await prisma.survey.findUnique({
      where: { id }
    })

    if (!survey) {
      return NextResponse.json({ error: 'Anket bulunamadi' }, { status: 404 })
    }

    if (survey.status === 'ACTIVE') {
      return NextResponse.json({ error: 'Anket zaten aktif' }, { status: 400 })
    }

    const updated = await prisma.survey.update({
      where: { id },
      data: { status: 'ACTIVE' }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Survey activate error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
