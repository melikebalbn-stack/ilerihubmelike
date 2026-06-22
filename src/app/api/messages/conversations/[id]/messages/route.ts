import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/lib/push-notifications'
import { requireUser } from '@/lib/auth/require-user'

// GET - Konusmadaki mesajlari getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-messages: requireUser → user.email (DB casing)
    const { user, error } = await requireUser()
    if (error) return error

    const { id: conversationId } = await params
    const userEmail = user.email

    // Kullanici bu konusmaya katilimci mi kontrol et
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userEmail: {
          conversationId,
          userEmail,
        },
      },
    })

    if (!participant || participant.leftAt) {
      return NextResponse.json({ error: 'Erisim yetkiniz yok' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // Cursor pagination

    // clearedAt varsa, bu tarihten önceki mesajları gösterme
    const clearedAt = participant.clearedAt

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(before && { createdAt: { lt: new Date(before) } }),
        ...(clearedAt && { createdAt: { gt: clearedAt } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        replyTo: {
          select: {
            id: true,
            content: true,
            senderName: true,
          },
        },
      },
    })

    // Okunmamis mesajlari okundu olarak isaretle
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userEmail: {
          conversationId,
          userEmail,
        },
      },
      data: {
        lastReadAt: new Date(),
        unreadCount: 0,
      },
    })

    return NextResponse.json({
      messages: messages.reverse(), // Kronolojik sira
      hasMore: messages.length === limit,
    })
  } catch (error) {
    console.error('Mesajlar getirilemedi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}

// POST - Yeni mesaj gonder
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-messages: requireUser → user.email + user.name (DB casing)
    const { user, error } = await requireUser()
    if (error) return error

    const { id: conversationId } = await params
    const userEmail = user.email
    const userName = user.name ?? userEmail

    // Kullanici bu konusmaya katilimci mi kontrol et
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userEmail: {
          conversationId,
          userEmail,
        },
      },
    })

    if (!participant || participant.leftAt) {
      return NextResponse.json({ error: 'Erisim yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const { content, replyToId, messageType = 'TEXT', attachmentUrl, attachmentName, attachmentType } = body

    if (!content?.trim() && messageType === 'TEXT') {
      return NextResponse.json({ error: 'Mesaj icerigi gerekli' }, { status: 400 })
    }

    // Mesaji olustur
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderEmail: userEmail,
        senderName: userName,
        content: content?.trim() || '',
        messageType,
        replyToId,
        attachmentUrl,
        attachmentName,
        attachmentType,
      },
      include: {
        replyTo: {
          select: {
            id: true,
            content: true,
            senderName: true,
          },
        },
      },
    })

    // Konusmayi guncelle
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessageText: content?.substring(0, 100) || '[Dosya]',
      },
    })

    // Diger katilimcilarin okunmamis sayisini artir
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userEmail: { not: userEmail },
        leftAt: null,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    })

    // Push notification gönder (async, beklemeden)
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: {
            userEmail: { not: userEmail },
            leftAt: null,
          },
        },
      },
    })

    console.log('📱 Push notification kontrolü başladı')
    console.log('📱 Konuşma:', conversation?.id, '| Katılımcı sayısı:', conversation?.participants?.length)

    if (conversation) {
      // Diğer katılımcılara push notification gönder
      for (const otherParticipant of conversation.participants) {
        console.log('📱 Katılımcı:', otherParticipant.userEmail)

        // Kullanıcının push subscription'larını bul
        const user = await prisma.user.findFirst({
          where: { email: otherParticipant.userEmail },
          include: { pushSubscriptions: true },
        })

        console.log('📱 User bulundu:', user?.email, '| Subscription sayısı:', user?.pushSubscriptions?.length || 0)

        if (user?.pushSubscriptions && user.pushSubscriptions.length > 0) {
          const notificationTitle = conversation.isGroup
            ? `${conversation.name || 'Grup'}`
            : userName

          const notificationBody = conversation.isGroup
            ? `${userName}: ${content?.substring(0, 50) || '[Dosya]'}${content && content.length > 50 ? '...' : ''}`
            : `${content?.substring(0, 60) || '[Dosya]'}${content && content.length > 60 ? '...' : ''}`

          console.log('📱 Push gönderiliyor:', notificationTitle, '-', notificationBody)

          for (const sub of user.pushSubscriptions) {
            console.log('📱 Subscription endpoint:', sub.endpoint.substring(0, 50) + '...')
            sendPushNotification(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              {
                title: notificationTitle,
                body: notificationBody,
                url: '/messages',
                tag: `message-${conversationId}`,
              }
            ).then(() => console.log('📱 Push başarılı gönderildi'))
            .catch((err) => console.error('📱 Push gönderme hatası:', err))
          }
        } else {
          console.log('📱 Bu kullanıcının push subscription\'ı yok')
        }
      }
    } else {
      console.log('📱 Konuşma bulunamadı')
    }

    return NextResponse.json(message)
  } catch (error) {
    console.error('Mesaj gonderilemedi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}
