import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// POST - Tepki ekle/kaldır
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email
    const body = await request.json()
    const { reactionType } = body

    if (!reactionType) {
      return NextResponse.json({ error: 'Tepki tipi zorunludur' }, { status: 400 })
    }

    // Duyuruyu kontrol et
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    if (!announcement.allowReactions) {
      return NextResponse.json({ error: 'Bu duyuruda tepkiler kapatilmis' }, { status: 400 })
    }

    // Mevcut tepkiyi kontrol et
    const existingReaction = await prisma.announcementReaction.findUnique({
      where: {
        announcementId_userEmail_reactionType: {
          announcementId: id,
          userEmail,
          reactionType
        }
      }
    })

    if (existingReaction) {
      // Tepki varsa kaldır
      await prisma.announcementReaction.delete({
        where: { id: existingReaction.id }
      })

      return NextResponse.json({ action: 'removed', reactionType })
    } else {
      // Tepki yoksa ekle
      await prisma.announcementReaction.create({
        data: {
          announcementId: id,
          userEmail,
          userName: user.name || userEmail,
          reactionType
        }
      })

      return NextResponse.json({ action: 'added', reactionType })
    }
  } catch (error) {
    console.error('Tepki islenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
