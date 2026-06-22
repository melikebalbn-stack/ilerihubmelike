import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'

// GET - Bir analizin tüm revizyonlarını listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-cost-analysis: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

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
