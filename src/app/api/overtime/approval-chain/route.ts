import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST: Seçili personel departmanlarına göre aktif onay zincirini döndür
 * Body: { personnelIds: string[], sendToGM?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { personnelIds, sendToGM = false } = body

    if (!personnelIds || !Array.isArray(personnelIds) || personnelIds.length === 0) {
      return NextResponse.json({ error: 'personnelIds zorunludur' }, { status: 400 })
    }

    // Personel departmanlarını topla
    const personnelRecords = await prisma.personnel.findMany({
      where: { id: { in: personnelIds } },
      select: { bolum: true },
    })
    const formDepartments = new Set(personnelRecords.map((p) => p.bolum))

    // Aktif onay pozisyonlarını çek
    const positions = await prisma.approvalPosition.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    })

    const maxStep = sendToGM ? 7 : 6

    // Departman bazlı filtreleme
    const chain = positions
      .filter((p) => {
        if (p.sortOrder > maxStep) return false

        // Ortak pozisyon
        if (!p.departments || p.departments.length === 0) return true

        // Koşullu pozisyon
        return p.departments.some((dept) => formDepartments.has(dept))
      })
      .map((p) => ({
        step: p.sortOrder,
        role: p.title,
        position: p.code,
        approver: p.user ? { id: p.user.id, name: p.user.name } : null,
        isCommon: !p.departments || p.departments.length === 0,
      }))

    return NextResponse.json({ chain, departments: Array.from(formDepartments) })
  } catch (error) {
    console.error('Onay zinciri hesaplanırken hata:', error)
    return NextResponse.json({ error: 'Onay zinciri hesaplanamadı' }, { status: 500 })
  }
}
