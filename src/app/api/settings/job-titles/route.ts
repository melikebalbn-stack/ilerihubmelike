import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

function hasAccess(role: string, department?: string | null): boolean {
  return ALLOWED_ROLES.includes(role) || isHRDepartment(department)
}

// GET: Görev listesini getir (aktif olanlar)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    const jobTitles = await prisma.jobTitle.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(jobTitles)
  } catch (error) {
    console.error('Görev listesi alınırken hata:', error)
    return NextResponse.json({ error: 'Görev listesi alınamadı' }, { status: 500 })
  }
}

// POST: Yeni görev ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { name } = await request.json()
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Görev adı zorunludur' }, { status: 400 })
    }

    const jobTitle = await prisma.jobTitle.create({
      data: { name: name.trim().toUpperCase() },
    })

    return NextResponse.json(jobTitle, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Bu görev zaten mevcut' }, { status: 409 })
    }
    console.error('Görev eklenirken hata:', error)
    return NextResponse.json({ error: 'Görev eklenemedi' }, { status: 500 })
  }
}

// PUT: Görev güncelle (isActive toggle veya rename)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id, name, isActive } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim().toUpperCase()
    if (isActive !== undefined) data.isActive = isActive

    const jobTitle = await prisma.jobTitle.update({
      where: { id },
      data,
    })

    return NextResponse.json(jobTitle)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Bu görev adı zaten mevcut' }, { status: 409 })
    }
    console.error('Görev güncellenirken hata:', error)
    return NextResponse.json({ error: 'Görev güncellenemedi' }, { status: 500 })
  }
}

// DELETE: Görev sil
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 })
    }

    await prisma.jobTitle.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Görev silinirken hata:', error)
    return NextResponse.json({ error: 'Görev silinemedi' }, { status: 500 })
  }
}
