import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'

// POST - Yorum ekle
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
    const { content, parentId } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Yorum icerigi zorunludur' }, { status: 400 })
    }

    // Duyuruyu kontrol et
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Duyuru bulunamadi' }, { status: 404 })
    }

    if (!announcement.allowComments) {
      return NextResponse.json({ error: 'Bu duyuruda yorumlar kapatilmis' }, { status: 400 })
    }

    // Üst yorum varsa kontrol et
    if (parentId) {
      const parentComment = await prisma.announcementComment.findUnique({
        where: { id: parentId }
      })

      if (!parentComment || parentComment.announcementId !== id) {
        return NextResponse.json({ error: 'Gecersiz ust yorum' }, { status: 400 })
      }
    }

    // Yorum oluştur
    const comment = await prisma.announcementComment.create({
      data: {
        announcementId: id,
        authorEmail: userEmail,
        authorName: user.name || userEmail,
        content: content.trim(),
        parentId
      }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Yorum eklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Yorum sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-announcements: requireUser
    const { session, user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const userEmail = user.email

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ error: 'Yorum ID zorunludur' }, { status: 400 })
    }

    // Yorumu bul
    const comment = await prisma.announcementComment.findUnique({
      where: { id: commentId }
    })

    if (!comment || comment.announcementId !== id) {
      return NextResponse.json({ error: 'Yorum bulunamadi' }, { status: 404 })
    }

    // PR-Y10: Yorum sahibi VEYA duyuru.admin yetkili
    const isAdmin = session.user.permissions?.includes('duyuru.admin') ?? false

    if (comment.authorEmail !== userEmail && !isAdmin) {
      return NextResponse.json({ error: 'Bu yorumu silme yetkiniz yok' }, { status: 403 })
    }

    // Yorumu sil
    await prisma.announcementComment.delete({
      where: { id: commentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Yorum silinirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
