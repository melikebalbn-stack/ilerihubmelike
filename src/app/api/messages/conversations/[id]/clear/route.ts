import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// POST - Kullanıcı için mesajları temizle (clearedAt ayarla)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-messages: requireUser → user.email (DB casing)
    const { user, error } = await requireUser()
    if (error) return error

    const { id: conversationId } = await params
    const userEmail = user.email

    // Kullanıcı bu konuşmaya katılımcı mı kontrol et
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userEmail: {
          conversationId,
          userEmail,
        },
      },
    })

    if (!participant || participant.leftAt) {
      return NextResponse.json({ error: 'Erişim yetkiniz yok' }, { status: 403 })
    }

    // clearedAt'i şimdi olarak ayarla - bu tarihten önceki mesajlar gösterilmeyecek
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userEmail: {
          conversationId,
          userEmail,
        },
      },
      data: {
        clearedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mesajlar temizlenemedi:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
