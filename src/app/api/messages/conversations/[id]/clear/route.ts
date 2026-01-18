import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Kullanıcı için mesajları temizle (clearedAt ayarla)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId } = await params
    const userEmail = session.user.email

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
