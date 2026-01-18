import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Kullanicinin toplam okunmamis mesaj sayisini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email

    // Kullanicinin tum konusmalarindaki okunmamis mesaj sayisini topla
    const result = await prisma.conversationParticipant.aggregate({
      where: {
        userEmail,
        leftAt: null, // Ayrilmamis konusmalar
      },
      _sum: {
        unreadCount: true,
      },
    })

    const totalUnread = result._sum.unreadCount || 0

    return NextResponse.json({ unreadCount: totalUnread })
  } catch (error) {
    console.error('Okunmamis mesaj sayisi alinamadi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}
