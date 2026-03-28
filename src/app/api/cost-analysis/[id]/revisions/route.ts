import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Bir analizin tüm revizyonlarını listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verilen analizin kodunu bul
    const analysis = await prisma.costAnalysis.findUnique({
      where: { id },
      select: { code: true },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Aynı koda sahip tüm revizyonları getir
    const revisions = await prisma.costAnalysis.findMany({
      where: { code: analysis.code },
      select: {
        id: true,
        code: true,
        name: true,
        revision: true,
        revisionNumber: true,
        revisionNote: true,
        revisionDate: true,
        status: true,
        totalCost: true,
        salesPrice: true,
        currency: true,
        isLatest: true,
        createdAt: true,
      },
      orderBy: { revisionNumber: 'asc' },
    })

    return NextResponse.json(revisions)
  } catch (error) {
    console.error('Revizyonlar alınırken hata:', error)
    return NextResponse.json(
      { error: 'Revizyonlar alınırken bir hata oluştu' },
      { status: 500 }
    )
  }
}
