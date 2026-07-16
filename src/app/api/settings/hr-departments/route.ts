import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function hasAccess(role: string, department?: string | null): boolean {
  if (ALLOWED_ROLES.includes(role)) return true
  return isInsanVarliklari(department)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const all = new URL(request.url).searchParams.get('all') === 'true'
    // PR-FAZ-B1: parent + sorumlu/müdür (id+ad) dahil
    const personSel = { select: { id: true, adSoyad: true, sicilNo: true } }
    const depts = await prisma.departmentDefinition.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        sorumlu1: personSel,
        sorumlu2: personSel,
        sorumlu3: personSel,
        sorumlu4: personSel,
        mudurYardimcisi: personSel,
        mudur: personSel,
      },
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

    const body = await request.json()
    const { id, name, isActive, parentId, sortOrder } = body
    if (!id) return NextResponse.json({ error: 'ID zorunludur' }, { status: 400 })

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim().toUpperCase()
    if (isActive !== undefined) data.isActive = isActive
    if (sortOrder !== undefined) data.sortOrder = Number(sortOrder) || 0

    // PR-FAZ-B1: parent (döngü engeli — kendisi olamaz)
    if (parentId !== undefined) {
      if (parentId === id) return NextResponse.json({ error: 'Bir bölüm kendisinin üst birimi olamaz' }, { status: 400 })
      if (parentId) {
        const p = await prisma.departmentDefinition.findUnique({ where: { id: parentId }, select: { id: true } })
        if (!p) return NextResponse.json({ error: 'Üst birim bulunamadı' }, { status: 400 })
      }
      data.parentId = parentId || null
    }

    // PR-FAZ-B1: sorumlu/müdür Personnel FK'leri — verilenleri aktif Personnel ile doğrula
    const personFields = ['sorumlu1Id', 'sorumlu2Id', 'sorumlu3Id', 'sorumlu4Id', 'mudurYardimcisiId', 'mudurId'] as const
    const idsToCheck = personFields
      .filter((f) => body[f] !== undefined && body[f])
      .map((f) => body[f] as string)
    if (idsToCheck.length > 0) {
      const found = await prisma.personnel.findMany({ where: { id: { in: idsToCheck } }, select: { id: true } })
      const foundSet = new Set(found.map((p) => p.id))
      const invalid = idsToCheck.filter((pid) => !foundSet.has(pid))
      if (invalid.length > 0) return NextResponse.json({ error: 'Geçersiz personel seçimi' }, { status: 400 })
    }
    for (const f of personFields) {
      if (body[f] !== undefined) data[f] = body[f] || null
    }

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

    // PR-FAZ-B1: çocuğu olan bölüm silinemez
    const childCount = await prisma.departmentDefinition.count({ where: { parentId: id } })
    if (childCount > 0) {
      return NextResponse.json({ error: `Bu bölümün ${childCount} alt birimi var — önce onları taşıyın/silin` }, { status: 409 })
    }

    await prisma.departmentDefinition.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bölüm silme hatası:', error)
    return NextResponse.json({ error: 'Bölüm silinemedi' }, { status: 500 })
  }
}
