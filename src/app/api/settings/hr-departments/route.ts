import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function hasAccess(role: string, department?: string | null): boolean {
  if (ALLOWED_ROLES.includes(role)) return true
  if (!department) return false
  const d = department.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const all = new URL(request.url).searchParams.get('all') === 'true'
    const depts = await prisma.departmentDefinition.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(depts)
  } catch (error) {
    console.error('Bölüm listesi hatası:', error)
    return NextResponse.json({ error: 'Bölüm listesi alınamadı' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

    const { name } = await request.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Bölüm adı zorunludur' }, { status: 400 })

    const dept = await prisma.departmentDefinition.create({ data: { name: name.trim().toUpperCase() } })
    return NextResponse.json(dept, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Bu bölüm zaten mevcut' }, { status: 409 })
    return NextResponse.json({ error: 'Bölüm eklenemedi' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

    const { id, name, isActive } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim().toUpperCase()
    if (isActive !== undefined) data.isActive = isActive

    const dept = await prisma.departmentDefinition.update({ where: { id }, data })
    return NextResponse.json(dept)
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Bu bölüm adı zaten mevcut' }, { status: 409 })
    return NextResponse.json({ error: 'Bölüm güncellenemedi' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userRole = (session.user as Record<string, unknown>).role as string
    const userDept = (session.user as Record<string, unknown>).department as string | null
    if (!hasAccess(userRole, userDept)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 })

    await prisma.departmentDefinition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bölüm silme hatası:', error)
    return NextResponse.json({ error: 'Bölüm silinemedi' }, { status: 500 })
  }
}
