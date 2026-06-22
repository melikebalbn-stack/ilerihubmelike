import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// DELETE - Sohbetten ayrıl / sohbeti sil
export async function DELETE(
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

    if (!participant) {
      return NextResponse.json({ error: 'Erişim yetkiniz yok' }, { status: 403 })
    }

    // Konuşma bilgisini al
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: { leftAt: null },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Konuşma bulunamadı' }, { status: 404 })
    }

    if (conversation.isGroup) {
      // Grup ise: Sadece katılımcıyı çıkar (leftAt ayarla)
      await prisma.conversationParticipant.update({
        where: {
          conversationId_userEmail: {
            conversationId,
            userEmail,
          },
        },
        data: {
          leftAt: new Date(),
        },
      })
    } else {
      // Birebir sohbet ise: Katılımcıyı çıkar
      await prisma.conversationParticipant.update({
        where: {
          conversationId_userEmail: {
            conversationId,
            userEmail,
          },
        },
        data: {
          leftAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sohbet silinemedi:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
