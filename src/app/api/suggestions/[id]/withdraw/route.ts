import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Öneriyi geri çek
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
    const body = await request.json()
    const { reason } = body

    // Öneriyi bul
    const suggestion = await prisma.suggestion.findUnique({
      where: { id }
    })

    if (!suggestion) {
      return NextResponse.json({ error: 'Öneri bulunamadı' }, { status: 404 })
    }

    // Sadece öneriyi gönderen kişi geri çekebilir
    if (suggestion.submittedBy !== session.user.email) {
      return NextResponse.json(
        { error: 'Bu öneriyi geri çekme yetkiniz yok' },
        { status: 403 }
      )
    }

    // Sadece belirli durumlarda geri çekilebilir
    const withdrawableStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'PENDING_APPROVAL']
    if (!withdrawableStatuses.includes(suggestion.status)) {
      return NextResponse.json(
        { error: 'Bu durumdaki öneri geri çekilemez' },
        { status: 400 }
      )
    }

    // Öneriyi güncelle
    const updatedSuggestion = await prisma.suggestion.update({
      where: { id },
      data: {
        status: 'WITHDRAWN',
        rejectionReason: reason || 'Kullanıcı tarafından geri çekildi'
      }
    })

    // Timeline'a ekle
    await prisma.suggestionTimeline.create({
      data: {
        suggestionId: id,
        action: 'Geri Çekildi',
        description: reason || 'Öneri sahibi tarafından geri çekildi',
        performedBy: session.user.email,
        performedByName: session.user.name || session.user.email,
        oldStatus: suggestion.status,
        newStatus: 'WITHDRAWN'
      }
    })

    return NextResponse.json({
      message: 'Öneri başarıyla geri çekildi',
      suggestion: updatedSuggestion
    })
  } catch (error) {
    console.error('Öneri geri çekilirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
