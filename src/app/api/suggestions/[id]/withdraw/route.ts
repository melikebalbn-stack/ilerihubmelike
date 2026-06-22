import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// POST - Öneriyi geri çek
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-suggestions: requireUser
    const { user, error } = await requireUser()
    if (error) return error

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
    // PR-EMAIL-NORMALIZE sonrası DB casing lowercase, user.email lowercase → match güvenli
    if (suggestion.submittedBy !== user.email) {
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
        performedBy: user.email,
        performedByName: user.name ?? user.email,
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
