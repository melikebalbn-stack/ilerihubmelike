import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendPushToUser, sendPushToAll, PushPayload } from '@/lib/push-notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Sadece admin kullanıcılar push gönderebilir
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user || !['SUPER_ADMIN', 'ADMIN', 'IT_MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, title, body: messageBody, url, sendToAll } = body

    if (!title || !messageBody) {
      return NextResponse.json({ error: 'Başlık ve mesaj gerekli' }, { status: 400 })
    }

    const payload: PushPayload = {
      title,
      body: messageBody,
      url: url || '/dashboard',
    }

    let successCount = 0

    if (sendToAll) {
      successCount = await sendPushToAll(prisma, payload)
    } else if (userId) {
      successCount = await sendPushToUser(prisma, userId, payload)
    } else {
      return NextResponse.json({ error: 'userId veya sendToAll gerekli' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sent: successCount
    })
  } catch (error) {
    console.error('Push gönderme hatası:', error)
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
