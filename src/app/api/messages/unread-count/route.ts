import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kullanicinin toplam okunmamis mesaj sayisini getir
export async function GET(_request: NextRequest) {
  try {
    // PR-Y2.5-messages: requireUser → user.email (DB casing)
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email

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
