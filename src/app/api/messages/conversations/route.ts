import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// GET - Kullanicinin konusmalarini listele
export async function GET(_request: NextRequest) {
  try {
    // PR-Y2.5-messages: requireUser → user.email (DB casing, lowercase)
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email

    // Kullanicinin katildigi konusmalar
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userEmail,
            leftAt: null, // Ayrilmamis
          },
        },
      },
      include: {
        participants: {
          where: {
            leftAt: null,
          },
          select: {
            userEmail: true,
            userName: true,
            userDepartment: true,
            unreadCount: true,
            lastReadAt: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            senderName: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    })

    // Konusmalari formatla
    const formattedConversations = conversations.map((conv) => {
      const otherParticipants = conv.participants.filter(p => p.userEmail !== userEmail)
      const currentUser = conv.participants.find(p => p.userEmail === userEmail)
      const lastMessage = conv.messages[0]

      return {
        id: conv.id,
        name: conv.isGroup ? conv.name : otherParticipants[0]?.userName,
        isGroup: conv.isGroup,
        participants: otherParticipants,
        unreadCount: currentUser?.unreadCount || 0,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          senderName: lastMessage.senderName,
          createdAt: lastMessage.createdAt,
        } : null,
        lastMessageAt: conv.lastMessageAt,
      }
    })

    return NextResponse.json(formattedConversations)
  } catch (error) {
    console.error('Konusmalar listelenemedi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}

// POST - Yeni konusma baslat
export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-messages: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const body = await request.json()
    const { name, isGroup } = body
    // PR-Y2.5-messages: input boundary normalization — UI'dan büyük harf gelirse normalize et
    const participantEmails: string[] = Array.isArray(body.participantEmails)
      ? body.participantEmails.map((e: string) => e.toLowerCase())
      : []

    if (participantEmails.length === 0) {
      return NextResponse.json({ error: 'Katilimci gerekli' }, { status: 400 })
    }

    const userEmail = user.email
    const userName = user.name ?? userEmail

    // 1-1 konusma icin: Ayni kisiyle mevcut konusma var mi kontrol et
    if (!isGroup && participantEmails.length === 1) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            {
              participants: {
                some: { userEmail, leftAt: null },
              },
            },
            {
              participants: {
                some: { userEmail: participantEmails[0], leftAt: null },
              },
            },
          ],
        },
      })

      if (existingConversation) {
        return NextResponse.json({ id: existingConversation.id, existing: true })
      }
    }

    // Yeni konusma olustur
    const conversation = await prisma.conversation.create({
      data: {
        name: isGroup ? name : null,
        isGroup: isGroup || false,
        participants: {
          create: [
            {
              userEmail,
              userName,
              userDepartment: user.department || null,
            },
            ...participantEmails.map((email: string) => ({
              userEmail: email,
              userName: email.split('@')[0], // Gecici isim, sonra LDAP'tan alinabilir
              userDepartment: null,
            })),
          ],
        },
      },
    })

    return NextResponse.json({ id: conversation.id, existing: false })
  } catch (error) {
    console.error('Konusma olusturulamadi:', error)
    return NextResponse.json({ error: 'Islem basarisiz' }, { status: 500 })
  }
}
